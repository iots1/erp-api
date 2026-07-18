import { Inject, Injectable } from '@nestjs/common';

import Redis from 'ioredis';

import { RedisService } from '@lib/common/enum/app-microservice.enum';

export const SESSION_KEY_PREFIX = 'session:';
export const SESSION_KEY_SCAN_COUNT = 200;

/** Authoritative shape of a live session, keyed `session:<jti>` in Redis. Written
 * once at login/refresh by auth-bc; read by every BC's AuthGuard on each request. */
export interface ISessionData {
  user_id: string;
  username: string;
  fullname: string | null;
  email: string;
  roles: string[];
  permissions: string[];
  conditional_permissions: string[];
}

/**
 * Single owner of the `session:<jti>` Redis key contract (prefix, JSON shape,
 * scan pattern) shared across every BC via the global {@link RedisModule}.
 * auth-bc is the only writer (login/refresh/logout/admin revoke); any other BC
 * that needs to read or invalidate a session (e.g. iam-bc forcing logout after
 * a permission change) reads/writes through this same service instead of
 * re-deriving the key format.
 */
@Injectable()
export class SessionStoreService {
  constructor(@Inject(RedisService.name) private readonly redisClient: Redis) {}

  buildKey(jti: string): string {
    return `${SESSION_KEY_PREFIX}${jti}`;
  }

  async create(
    jti: string,
    data: ISessionData,
    ttlSeconds: number,
  ): Promise<void> {
    await this.redisClient.setex(
      this.buildKey(jti),
      ttlSeconds,
      JSON.stringify(data),
    );
  }

  async get(jti: string): Promise<ISessionData | null> {
    const raw = await this.redisClient.get(this.buildKey(jti));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ISessionData;
    } catch {
      return null;
    }
  }

  async ttl(jti: string): Promise<number> {
    return this.redisClient.ttl(this.buildKey(jti));
  }

  async revoke(jti: string): Promise<void> {
    await this.redisClient.del(this.buildKey(jti));
  }

  /** jti extracted from a raw `session:<jti>` key, e.g. as returned by {@link scanKeys}. */
  jtiFromKey(key: string): string {
    return key.slice(SESSION_KEY_PREFIX.length);
  }

  /** Full keyspace scan — there is no per-user index, so listing means scanning.
   * Fine for an admin tool; the key count is bounded by concurrently logged-in users. */
  async scanKeys(): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, batch] = await this.redisClient.scan(
        cursor,
        'MATCH',
        `${SESSION_KEY_PREFIX}*`,
        'COUNT',
        SESSION_KEY_SCAN_COUNT,
      );
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');
    return keys;
  }
}
