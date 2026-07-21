// MUST be first: starts the OpenTelemetry SDK before http/pg/nestjs are loaded
// so auto-instrumentation can patch them (see tracing.ts). Do not reorder.
// (Side-effect only here — shutdownTracing() itself is called from
// GracefulShutdownService.onApplicationShutdown(), not from this file.)
import '../tracing';

import { timingSafeEqual } from 'crypto';
import {
  ClassSerializerInterceptor,
  Type,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { IoAdapter } from '@nestjs/platform-socket.io';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import { apiReference } from '@scalar/nestjs-api-reference';
import { createAdapter } from '@socket.io/redis-adapter';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { FastifyReply, FastifyRequest } from 'fastify';
import { createClient, type RedisClientType } from 'redis';
import { Server as SocketIOServer, type ServerOptions } from 'socket.io';

import { AppMicroserviceKey } from '@lib/common/enum/app-microservice.enum';
import { DocAuthKey } from '@lib/common/enum/doc-auth-key.enum';
import { GracefulShutdownService } from '@lib/common/services/graceful-shutdown.service';
import { AllExceptionsFilter } from '@lib/common/utils/http-exception/all-exceptions-filter.util';
import { RpcExceptionsFilter } from '@lib/common/utils/http-exception/rpc-exceptions-filter.util';
import { ValidationException } from '@lib/common/utils/http-exception/validation.exception';
import { flattenValidationErrors } from '@lib/common/utils/http-exception/validation.helper';
import { LocalizationInterceptor } from '@lib/common/utils/http-success/localization-interceptor.util';
import { TransformInterceptor } from '@lib/common/utils/http-success/transform-interceptor.util';
import {
  buildServerOptions,
  resolveTransport,
} from '@lib/common/utils/microservice-transport.util';

// ──────────────────────────────────────────────────────────────
//  Options
// ──────────────────────────────────────────────────────────────

export interface JwtAuthOptions {
  name: string;
  description?: string;
}

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  message?: string;
}

export interface SecurityOptions {
  helmet?: boolean;
  rateLimit?: RateLimitOptions | false;
  cors?: {
    origin?: string | string[];
    exposedHeaders?: string | string[];
    methods?: string | string[];
  };
}

export interface BootstrapViewsOptions {
  dir: string;
  engine?: string;
}

export interface BootstrapOptions {
  module: Type<unknown>;
  globalPrefixNameEnv: string;
  globalPrefixVersionEnv: string;
  defaultGlobalPrefixName: string;
  defaultGlobalPrefixVersion: string;
  httpPortEnv: string;
  microservice?: AppMicroserviceKey;
  useIoAdapter?: boolean;
  views?: BootstrapViewsOptions;
  publicDir?: string;
  swagger: {
    title: string;
    description: string;
    version?: string;
    tag: string;
  };
  jwtAuth?: JwtAuthOptions;
  basicAuth?: boolean;
  security?: SecurityOptions;
  forbidNonWhitelisted?: boolean;
}

// ──────────────────────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────────────────────

function initializeTimezone(): void {
  process.env.TZ = 'Asia/Bangkok';
  dayjs.extend(utc);
  dayjs.extend(timezone);
  dayjs.tz.setDefault('Asia/Bangkok');
}

/**
 * Resolve Fastify `trustProxy` from process.env directly.
 * Needed before configService is initialized to inject into FastifyAdapter.
 */
function resolveTrustProxy(raw?: string): boolean | number | string[] {
  if (raw === undefined || raw.trim().length === 0) {
    return ['127.0.0.1', '100.64.0.0/10'];
  }
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^\d+$/.test(raw)) return parseInt(raw, 10);
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

async function applySecurity(
  app: NestFastifyApplication,
  configService: ConfigService,
  security?: SecurityOptions,
): Promise<void> {
  const corsOrigin =
    security?.cors?.origin ?? configService.get<string>('CORS_ORIGIN') ?? '*';
  const exposedHeaders = security?.cors?.exposedHeaders ?? ['X-Trace-Id'];
  // @fastify/cors defaults `methods` to 'GET,HEAD,POST' only (no PUT/PATCH/DELETE) —
  // every BC needs the full REST verb set since browsers preflight cross-origin
  // PUT/PATCH/DELETE calls (same-origin requests never preflight, so this only bit
  // once a page started calling *another* BC's API directly, e.g. iam-view calling
  // auth-bc's DELETE /auth/sessions/:jti — see the 2026-07-18 CORS incident).
  const corsMethods = security?.cors?.methods ?? [
    'GET',
    'HEAD',
    'PUT',
    'PATCH',
    'POST',
    'DELETE',
  ];
  app.enableCors({ origin: corsOrigin, exposedHeaders, methods: corsMethods });

  if (security?.helmet !== false) {
    await app.register(fastifyHelmet, { contentSecurityPolicy: false });
  }

  if (security?.rateLimit !== false) {
    const opts = security?.rateLimit ?? {};
    await app.register(fastifyRateLimit, {
      max: configService.get<number>('RATE_LIMIT_MAX') ?? opts.max ?? 10000,
      timeWindow:
        configService.get<number>('RATE_LIMIT_WINDOW_MS') ??
        opts.windowMs ??
        15 * 60 * 1000,
      errorResponseBuilder: () => ({
        status: { code: 429, message: 'Too Many Requests' },
        errors: [
          {
            code: 'TOO_MANY_REQUESTS',
            title: 'Too Many Requests',
            detail:
              opts.message ?? 'Too many requests, please try again later.',
          },
        ],
        meta: { timestamp: new Date().toISOString() },
      }),
    });
  }
}

// ──────────────────────────────────────────────────────────────
//  View Engine & Static Assets (Requires @fastify/view & @fastify/static)
// ──────────────────────────────────────────────────────────────

async function setupViewsAndStatic(
  app: NestFastifyApplication,
  options: BootstrapOptions,
  pathURI: string,
): Promise<void> {
  // NOTE: Make sure to install `@fastify/static` and `@fastify/view`
  if (options.publicDir) {
    app.useStaticAssets({
      root: options.publicDir,
      prefix: `/${pathURI}/assets/`,
    });
  }

  if (options.views) {
    // This await resolves the ESLint require-await error
    // and correctly imports the module asynchronously.
    const ejs = await import('ejs');

    app.setViewEngine({
      engine: { ejs },
      templates: options.views.dir,
    });
  }
}

function registerGlobalMiddleware(
  app: NestFastifyApplication,
  reflector: Reflector,
  forbidNonWhitelisted: boolean,
): void {
  app.useGlobalFilters(new RpcExceptionsFilter(), new AllExceptionsFilter());

  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(reflector),
    new LocalizationInterceptor(),
    new TransformInterceptor(reflector),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted,
      stopAtFirstError: false,
      transformOptions: { enableImplicitConversion: false },
      exceptionFactory: (errors: ValidationError[]): never => {
        throw new ValidationException(flattenValidationErrors(errors));
      },
    }),
  );
}

// ──────────────────────────────────────────────────────────────
//  OpenAPI / Swagger / Scalar
// ──────────────────────────────────────────────────────────────

function setupApiDocs(
  app: NestFastifyApplication,
  options: BootstrapOptions,
  pathURI: string,
  configService: ConfigService,
): { fullDocsPath: string; classicDocsPath: string } {
  const swaggerDocsEndpoint =
    configService.get<string>('SWAGGER_DOCS_ENDPOINT') ?? 'api-docs';
  const swaggerJsonEndpoint =
    configService.get<string>('SWAGGER_JSON_ENDPOINT') ?? 'json-docs';
  const swaggerClassicDocsEndpoint =
    configService.get<string>('SWAGGER_CLASSIC_DOCS_ENDPOINT') ??
    'classic-docs';

  const fullDocsPath = `/${pathURI}/${swaggerDocsEndpoint}`;
  const jsonDocsPath = `/${pathURI}/${swaggerJsonEndpoint}`;
  const classicDocsPath = `/${pathURI}/${swaggerClassicDocsEndpoint}`;

  // --- Fastify Basic Auth Hook for Docs ---
  const docsUsername = configService.get<string>('SWAGGER_USERNAME');
  const docsPassword = configService.get<string>('SWAGGER_PASSWORD');

  if (docsUsername && docsPassword) {
    const expected = Buffer.from(`${docsUsername}:${docsPassword}`);
    app
      .getHttpAdapter()
      .getInstance()
      .addHook('onRequest', (req, reply, done) => {
        if (
          req.url.startsWith(fullDocsPath) ||
          req.url.startsWith(jsonDocsPath) ||
          req.url.startsWith(classicDocsPath)
        ) {
          const authHeader = req.headers['authorization'];
          if (authHeader && authHeader.startsWith('Basic ')) {
            const provided = Buffer.from(authHeader.slice(6), 'base64');
            if (
              provided.length === expected.length &&
              timingSafeEqual(provided, expected)
            ) {
              return done();
            }
          }
          reply.header('WWW-Authenticate', 'Basic realm="API Documentation"');
          reply.code(401).send({
            status: { code: 401, message: 'Unauthorized' },
            errors: [
              {
                code: 'UNAUTHORIZED',
                title: 'Unauthorized',
                detail: 'API documentation requires authentication.',
              },
            ],
            meta: { timestamp: new Date().toISOString() },
          });
          return; // Prevent further execution for docs path
        }
        done();
      });
  }

  // --- Build OpenAPI document ---
  const builder = new DocumentBuilder()
    .setTitle(options.swagger.title)
    .setDescription(options.swagger.description)
    .setVersion(options.swagger.version ?? '1.0')
    .addTag(options.swagger.tag);

  if (options.jwtAuth) {
    builder.addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'access-token',
        description: options.jwtAuth.description ?? 'Enter JWT token',
        in: 'header',
      },
      options.jwtAuth.name,
    );
    builder.addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-csrf-token',
        description: 'Enter the CSRF token obtained from the session',
      },
      DocAuthKey.CSRF_TOKEN,
    );
    builder.addSecurityRequirements({
      [options.jwtAuth.name]: [],
      [DocAuthKey.CSRF_TOKEN]: [],
    });
  }

  if (options.basicAuth) {
    builder.addBasicAuth(
      { type: 'http', scheme: 'basic', description: 'Basic Authentication' },
      DocAuthKey.BASIC_AUTH,
    );
  }

  const document = SwaggerModule.createDocument(app, builder.build());

  app.use(
    fullDocsPath,
    apiReference({
      url: jsonDocsPath,
      persistAuth: true,
      showSidebar: true,
      searchHotKey: 'k',
      withFastify: true,
    }),
  );

  SwaggerModule.setup(classicDocsPath, app, document, {
    customSiteTitle: options.swagger.title,
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });

  app
    .getHttpAdapter()
    .get(jsonDocsPath, (_req: FastifyRequest, reply: FastifyReply) => {
      void reply.header('Content-Type', 'application/json').send(document);
    });

  return { fullDocsPath, classicDocsPath };
}

// ──────────────────────────────────────────────────────────────
//  Health Check & Versioning
// ──────────────────────────────────────────────────────────────

function resolveAppVersion(configService: ConfigService): string {
  const version = configService.get<string>('APP_VERSION');
  return version !== undefined && version.length > 0 ? version : 'local';
}

function registerHealthCheck(
  app: NestFastifyApplication,
  pathURI: string,
  moduleName: string,
  version: string,
  environment: string,
  isShuttingDown: () => boolean,
): void {
  // Liveness: always 200 while the process is alive, even mid-shutdown — used
  // by orchestrators to decide whether to kill/restart the process, not
  // whether to route traffic to it.
  app
    .getHttpAdapter()
    .get(`/${pathURI}/health`, (_req: FastifyRequest, reply: FastifyReply) => {
      void reply.status(200).send({
        status: 'ok',
        message: `Service ${moduleName} is running`,
        version,
        environment,
        timestamp: new Date().toISOString(),
      });
    });

  // Readiness: separate from liveness above so a load balancer / gateway
  // stops routing NEW requests the instant shutdown begins, while the
  // process itself stays alive to drain in-flight work (see
  // registerGracefulShutdown).
  app
    .getHttpAdapter()
    .get(
      `/${pathURI}/health/ready`,
      (_req: FastifyRequest, reply: FastifyReply) => {
        if (isShuttingDown()) {
          void reply.status(503).send({
            status: 'shutting_down',
            message: `Service ${moduleName} is draining connections`,
            timestamp: new Date().toISOString(),
          });
          return;
        }
        void reply.status(200).send({
          status: 'ready',
          message: `Service ${moduleName} is ready`,
          timestamp: new Date().toISOString(),
        });
      },
    );
}

// ──────────────────────────────────────────────────────────────
//  Graceful Shutdown
// ──────────────────────────────────────────────────────────────

/**
 * Resolves the app-wide `GracefulShutdownService` (provided globally via
 * `CommonModule`) and wires it up: `app.enableShutdownHooks()` +
 * `OnApplicationShutdown` (see graceful-shutdown.service.ts for the full
 * sequence). Returns `isShuttingDown` for the readiness route.
 */
function registerGracefulShutdown(
  app: NestFastifyApplication,
  configService: ConfigService,
  moduleName: string,
): { isShuttingDown: () => boolean } {
  const shutdownService = app.get(GracefulShutdownService);
  const shutdownTimeoutMs = configService.get<number>('SHUTDOWN_TIMEOUT_MS');

  shutdownService.registerSignalHandlers(app, moduleName, shutdownTimeoutMs);

  return { isShuttingDown: shutdownService.isShuttingDown };
}

// ──────────────────────────────────────────────────────────────
//  Socket.io Adapter (Redis fallback to in-memory)
// ──────────────────────────────────────────────────────────────

async function setupSocketIoAdapter(
  app: NestFastifyApplication,
  configService: ConfigService,
  moduleName: string,
): Promise<void> {
  try {
    const host = configService.get<string | undefined>('SOCKET_REDIS_HOST');
    const port = configService.get<number | undefined>('SOCKET_REDIS_PORT');
    const password = configService.get<string | undefined>(
      'SOCKET_REDIS_PASSWORD',
    );
    const db = configService.get<number | undefined>('SOCKET_REDIS_DB') ?? 1;

    if (host === undefined || port === undefined || port <= 0) {
      throw new Error(
        'SOCKET_REDIS_HOST or SOCKET_REDIS_PORT not properly configured',
      );
    }

    const pubClient: RedisClientType = createClient({
      socket: { host, port },
      ...(password !== undefined && password.length > 0 ? { password } : {}),
      database: db,
    });

    const subClient: RedisClientType = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);

    class RedisIoAdapter extends IoAdapter {
      public createIOServer(
        port: number,
        options?: ServerOptions,
      ): SocketIOServer {
        const server = super.createIOServer(port, options) as SocketIOServer;
        server.adapter(createAdapter(pubClient, subClient));
        return server;
      }
    }

    app.useWebSocketAdapter(new RedisIoAdapter(app));
    console.log(
      `🔌 [${moduleName}] Socket.io adapter enabled with Redis pub/sub (${host}:${port}/db${db})`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(
      `⚠️  [${moduleName}] Failed to initialize Redis Socket adapter, falling back to in-memory:`,
      errorMessage,
    );
    app.useWebSocketAdapter(new IoAdapter(app));
    console.log(
      `🔌 [${moduleName}] Socket.io adapter enabled (in-memory only)`,
    );
  }
}

// ──────────────────────────────────────────────────────────────
//  Microservices
// ──────────────────────────────────────────────────────────────

async function setupMicroservice(
  app: NestFastifyApplication,
  configService: ConfigService,
  moduleName: string,
  microservice: AppMicroserviceKey,
): Promise<void> {
  const options = buildServerOptions(microservice, configService);

  app.connectMicroservice<MicroserviceOptions>(options);
  await app.startAllMicroservices();

  const transport = resolveTransport(configService);
  const opts = (options.options ?? {}) as { queue?: string; port?: number };
  const endpoint =
    transport === 'rmq' ? `queue '${opts.queue}'` : `port ${opts.port}`;
  console.log(
    `🚀 [${moduleName}] Microservice (${transport.toUpperCase()}) listening on ${endpoint}`,
  );
}

function resolveHttpPort(
  configService: ConfigService,
  httpPortEnv: string,
): number {
  const port = Number(configService.get<number>(httpPortEnv));
  if (Number.isNaN(port)) {
    throw new Error(`HTTP port env '${httpPortEnv}' is not defined.`);
  }
  return port;
}

// ──────────────────────────────────────────────────────────────
//  Main Bootstrap
// ──────────────────────────────────────────────────────────────

export async function bootstrapApplication(
  options: BootstrapOptions,
): Promise<NestFastifyApplication> {
  initializeTimezone();

  // Note: trustProxy read directly from process.env before ConfigService is available.
  const trustProxy = resolveTrustProxy(process.env.TRUST_PROXY);
  const adapter = new FastifyAdapter({ trustProxy, logger: false });

  const app = await NestFactory.create<NestFastifyApplication>(
    options.module,
    adapter,
    { rawBody: true },
  );

  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);
  const moduleName = (options.module as { name: string }).name;

  // --- Graceful Shutdown (register early so a signal during the rest of
  // bootstrap is still handled instead of falling through to Node's default
  // immediate-exit behavior) ---
  const { isShuttingDown } = registerGracefulShutdown(
    app,
    configService,
    moduleName,
  );

  // --- Security ---
  await applySecurity(app, configService, options.security);

  // --- Global Prefix ---
  const listenPORT = resolveHttpPort(configService, options.httpPortEnv);
  const globalPrefixName =
    configService.get<string>(options.globalPrefixNameEnv) ??
    options.defaultGlobalPrefixName;
  const globalPrefixVersion =
    configService.get<string>(options.globalPrefixVersionEnv) ??
    options.defaultGlobalPrefixVersion;
  const pathURI = `${globalPrefixName}/${globalPrefixVersion}`;
  app.setGlobalPrefix(pathURI);

  // --- Views & Static Assets (Optional) ---
  if (options.views || options.publicDir) {
    await setupViewsAndStatic(app, options, pathURI);
  }

  // --- Global Middlewares ---
  registerGlobalMiddleware(
    app,
    reflector,
    options.forbidNonWhitelisted ?? false,
  );

  // --- API Documentation ---
  const { fullDocsPath, classicDocsPath } = setupApiDocs(
    app,
    options,
    pathURI,
    configService,
  );

  // --- Health Check ---
  const appVersion = resolveAppVersion(configService);
  const environment = configService.get<string>('NODE_ENV') ?? 'local';
  registerHealthCheck(
    app,
    pathURI,
    moduleName,
    appVersion,
    environment,
    isShuttingDown,
  );

  // --- Microservice ---
  if (options.microservice !== undefined) {
    await setupMicroservice(
      app,
      configService,
      moduleName,
      options.microservice,
    );
  }

  // --- Socket.io Adapter ---
  if (options.useIoAdapter) {
    await setupSocketIoAdapter(app, configService, moduleName);
  }

  await app.listen(listenPORT, '0.0.0.0');

  // --- Startup Logs ---
  console.log(
    `🚀 [${moduleName}] HTTP running on: http://localhost:${listenPORT}/${pathURI}`,
  );
  console.log(
    `📄 [${moduleName}] API Docs (Scalar): http://localhost:${listenPORT}${fullDocsPath}`,
  );
  console.log(
    `📄 [${moduleName}] API Docs (Swagger): http://localhost:${listenPORT}${classicDocsPath}`,
  );

  // --- PM2 readiness signal (paired with `wait_ready: true` in
  // ecosystem.config.js) — tells PM2 this instance is fully up before it
  // considers a `pm2 reload` complete, so the old instance isn't torn down
  // until the new one can actually serve traffic. No-op outside PM2 fork
  // mode (process.send is undefined there). ---
  if (typeof process.send === 'function') {
    process.send('ready');
  }

  return app;
}
