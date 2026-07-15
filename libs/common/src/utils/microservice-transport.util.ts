import { ConfigService } from '@nestjs/config';
import {
  ClientProvider,
  RmqOptions,
  TcpOptions,
  Transport,
} from '@nestjs/microservices';

import {
  AppMicroservice,
  AppMicroserviceKey,
} from '@lib/common/enum/app-microservice.enum';

/**
 * Supported inter-service transports. RabbitMQ (`rmq`) is the platform default;
 * `tcp` is the fallback used when the broker is unavailable.
 */
export type MicroserviceTransport = 'rmq' | 'tcp';

type AppMicroserviceEntry = (typeof AppMicroservice)[AppMicroserviceKey];

/** RabbitMQ connection URL(s), passed as an object so `@`-laden passwords need no encoding. */
type RmqUrls = NonNullable<RmqOptions['options']>['urls'];

/**
 * Resolve the active transport for the whole platform from the `TRANSPORT` env
 * key (default `rmq`). Both the client registrations ({@link CommonModule}) and
 * the server listeners ({@link bootstrapApplication}) read the same value, so a
 * single env change (plus restart) flips every BC between RabbitMQ and TCP.
 *
 * There is no automatic per-request failover: RabbitMQ already handles transient
 * broker outages via durable queues + publisher retries. If RabbitMQ is down for
 * good, set `TRANSPORT=tcp` and restart to fall back to direct TCP.
 */
export function resolveTransport(config: ConfigService): MicroserviceTransport {
  return config.get<string>('TRANSPORT') === 'tcp' ? 'tcp' : 'rmq';
}

function buildRmqUrls(config: ConfigService): RmqUrls {
  return [
    {
      protocol: 'amqp',
      hostname: config.get<string>('RABBITMQ_HOST', 'localhost'),
      port: config.get<number>('RABBITMQ_PORT', 5672),
      username: config.get<string>('RABBITMQ_USER', 'guest'),
      password: config.get<string>('RABBITMQ_PASS', 'guest'),
      vhost: config.get<string>('RABBITMQ_VHOST', '/'),
    },
  ];
}

/**
 * Build the `ClientProxy` provider config for injecting `service` from another BC.
 * Honours the platform-wide {@link resolveTransport} selection.
 */
export function buildClientProvider(
  service: AppMicroserviceEntry,
  config: ConfigService,
): ClientProvider {
  if (resolveTransport(config) === 'tcp') {
    return {
      transport: Transport.TCP,
      options: {
        host: config.get<string>(service.hostEnv, 'localhost'),
        port: config.get<number>(service.portEnv),
      },
    };
  }

  return {
    transport: Transport.RMQ,
    options: {
      urls: buildRmqUrls(config),
      queue: service.queue,
      queueOptions: { durable: true },
    },
  };
}

/**
 * Build the microservice listener options for a BC's own server, keyed by its
 * {@link AppMicroservice} entry. Honours the platform-wide transport selection.
 * The TCP listener binds `0.0.0.0` so it is reachable from other containers.
 */
export function buildServerOptions(
  key: AppMicroserviceKey,
  config: ConfigService,
): RmqOptions | TcpOptions {
  const service = AppMicroservice[key];

  if (resolveTransport(config) === 'tcp') {
    return {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: config.get<number>(service.portEnv),
      },
    };
  }

  return {
    transport: Transport.RMQ,
    options: {
      urls: buildRmqUrls(config),
      queue: service.queue,
      queueOptions: { durable: true },
      // Manual ack on the server so failed handlers don't silently drop messages.
      noAck: false,
      prefetchCount: 1,
    },
  };
}
