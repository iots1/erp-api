import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClientProvider,
  RmqOptions,
  TcpOptions,
  Transport,
} from '@nestjs/microservices';

import {
  AmqpConnectionManagerClass,
  type ChannelWrapper,
  type CreateChannelOpts,
} from 'amqp-connection-manager';

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
 * Connection tuning shared by every client and server registration.
 *
 * `amqp-connection-manager` defaults `heartbeatIntervalInSeconds` to **5**, so a
 * client that goes quiet for ~10s (laptop sleep, a stalled event loop, a brief
 * packet-loss window on a WAN link to the broker) is dropped by RabbitMQ with
 * `missed heartbeats from client, timeout: 5s`, surfacing on this side as
 * `ECONNRESET` / "Disconnected from RMQ. Trying to reconnect." That is far too
 * aggressive for a broker reached over the internet rather than a local docker
 * network, so the interval is widened (broker closes after 2 missed intervals ≈
 * 40s) and made env-tunable.
 */
function buildRmqSocketOptions(config: ConfigService) {
  return {
    heartbeatIntervalInSeconds: config.get<number>('RABBITMQ_HEARTBEAT', 20),
    reconnectTimeInSeconds: config.get<number>('RABBITMQ_RECONNECT_DELAY', 5),
  };
}

/** Shape of `AmqpConnectionManager.prototype.createChannel`, plus the flag used
 * to mark it as already wrapped by {@link installRmqChannelErrorGuard}. */
type CreateChannelFn = ((options?: CreateChannelOpts) => ChannelWrapper) & {
  is_channel_error_guard_installed?: boolean;
};

/**
 * Attach an `error` listener to every `ChannelWrapper` the RMQ transport creates,
 * so a mid-flight broker disconnect can never take the whole process down.
 *
 * `ChannelWrapper` is an `EventEmitter` that emits `error` on four *recoverable*
 * paths (a setup function that rejects, a failed `_onConnect`, a failed publish
 * worker tick, a failed consumer re-registration). NestJS attaches listeners to
 * the `AmqpConnectionManager` — `connect`/`disconnect`/`blocked`/`unblocked` —
 * but never to the `ChannelWrapper` it builds from it (`ClientRMQ.createChannel()`
 * and `ServerRMQ.start()` both store the wrapper unlistened). Node's
 * `EventEmitter` contract turns an `error` emit with no listener into a thrown
 * exception, so each of those recoverable errors instead **crashes the service**:
 *
 *     Error: Channel ended, no reply will be forthcoming
 *         at ConfirmChannel._rejectPending (amqplib/lib/channel.js:159)
 *       Emitted 'error' event on ChannelWrapper instance at:
 *         at ChannelWrapper._onConnect (amqp-connection-manager/…/ChannelWrapper.js:323)
 *
 * That is precisely what a laptop waking from sleep produces: the socket to the
 * broker died with no FIN/RST, the reconnect starts asserting the queue, the dead
 * connection tears the channel down mid-setup, and the rejected setup promise is
 * emitted as `error` with nobody listening. The same sequence occurs in
 * production on any disconnect with work in flight — broker restart/failover, an
 * idle connection reaped by a load balancer, a pod eviction — so this is a real
 * availability bug, not a local-dev artifact.
 *
 * Distinct from the heartbeat tuning in {@link buildRmqSocketOptions}: that
 * governs how eagerly a disconnect is *declared*, this governs what happens once
 * one occurs. Logging is the entire fix — `amqp-connection-manager` reconnects
 * after `reconnectTimeInSeconds` and re-runs each wrapper's setup (which for
 * NestJS re-asserts the queue and re-registers the consumer), so the listener
 * exists to satisfy the `EventEmitter` contract and make the event visible, not
 * to drive recovery.
 *
 * Patching `createChannel` rather than any individual proxy is deliberate: it is
 * the single factory every wrapper comes from, so one hook covers both the client
 * and the server, the initial channel and every one rebuilt on a later reconnect
 * — without reaching into NestJS's protected `channel` field or forcing the
 * lazily-connected clients to connect early. Idempotent (a second call is a
 * no-op) and must run before any BC connects, hence the call at the top of
 * `bootstrapApplication`.
 */
export function installRmqChannelErrorGuard(): void {
  const prototype = AmqpConnectionManagerClass.prototype;
  // Deliberately captured unbound: the wrapper re-binds it with `.call(this, …)`
  // so it runs against whichever connection manager instance invoked it.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalCreateChannel = prototype.createChannel as CreateChannelFn;

  if (originalCreateChannel.is_channel_error_guard_installed === true) {
    return;
  }

  const logger = new Logger('RmqChannelErrorGuard');

  const guardedCreateChannel: CreateChannelFn = function (
    this: AmqpConnectionManagerClass,
    options?: CreateChannelOpts,
  ): ChannelWrapper {
    // Cast back explicitly: `strictBindCallApply` is off, so `.call()` is typed
    // `any` and would otherwise erase ChannelWrapper's `on('error')` overload.
    const channel = originalCreateChannel.call(this, options) as ChannelWrapper;

    // `info` is typed as always-present upstream, but two of the four emit sites
    // (`_startWorker`, the consumer re-register path) pass the error alone — so
    // it genuinely is undefined at runtime and must be read defensively.
    channel.on('error', (error: Error, info?: { name?: string }): void => {
      const channelName = info?.name;
      logger.error(
        `RMQ channel error${channelName === undefined ? '' : ` on '${channelName}'`}: ${error.message} — connection manager will reconnect`,
        error.stack,
      );
    });

    return channel;
  };

  guardedCreateChannel.is_channel_error_guard_installed = true;
  prototype.createChannel = guardedCreateChannel;
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
      socketOptions: buildRmqSocketOptions(config),
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
      socketOptions: buildRmqSocketOptions(config),
      // Manual ack on the server so failed handlers don't silently drop messages.
      noAck: false,
      prefetchCount: 1,
    },
  };
}
