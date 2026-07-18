import { Inject, Injectable } from '@nestjs/common';

import Redis from 'ioredis';

import { RedisService } from '@lib/common/enum/app-microservice.enum';

export const SESSION_KEY_PREFIX = 'session:';
export const SESSION_KEY_SCAN_COUNT = 200;
export const USER_SESSIONS_KEY_PREFIX = 'user_sessions:';

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

export interface IActiveSession {
  jti: string;
  session: ISessionData;
  ttl_seconds: number;
}

/**
 * Single owner of the `session:<jti>` Redis key contract (prefix, JSON shape,
 * scan pattern) shared across every BC via the global {@link RedisModule}.
 * auth-bc is the only writer of new sessions (login/refresh/logout/admin
 * revoke); any other BC that needs to read or invalidate a session (e.g.
 * iam-bc pushing a permission change into an active session) reads/writes
 * through this same service instead of re-deriving the key format.
 *
 * `user_sessions:<user_id>` is a companion Redis SET of that user's live
 * `jti`s — there is no TTL on the set itself (Redis SETs can't expire
 * individual members), so every read path here (`listActiveSessions` and
 * everything built on it) lazily `SREM`s members whose `session:<jti>` key
 * has already expired. That keeps the set bounded to roughly one user's
 * concurrent-login count instead of growing forever.
 */
@Injectable()
export class SessionStoreService {
  constructor(@Inject(RedisService.name) private readonly redisClient: Redis) {}

  buildKey(jti: string): string {
    return `${SESSION_KEY_PREFIX}${jti}`;
  }

  buildUserIndexKey(userId: string): string {
    return `${USER_SESSIONS_KEY_PREFIX}${userId}`;
  }

  async create(
    jti: string,
    data: ISessionData,
    ttlSeconds: number,
  ): Promise<void> {
    const pipeline = this.redisClient.pipeline();
    pipeline.setex(this.buildKey(jti), ttlSeconds, JSON.stringify(data));
    pipeline.sadd(this.buildUserIndexKey(data.user_id), jti);
    await pipeline.exec();
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

  /** Kills one session and drops it from its owner's index. */
  async revoke(jti: string): Promise<void> {
    const session = await this.get(jti);
    const pipeline = this.redisClient.pipeline();
    pipeline.del(this.buildKey(jti));
    if (session) {
      pipeline.srem(this.buildUserIndexKey(session.user_id), jti);
    }
    await pipeline.exec();
  }

  /** jti extracted from a raw `session:<jti>` key, e.g. as returned by {@link scanKeys}. */
  jtiFromKey(key: string): string {
    return key.slice(SESSION_KEY_PREFIX.length);
  }

  /** Full keyspace scan across every user — there is no global index, so listing
   * everyone means scanning. Fine for an admin "who's online" tool; the key
   * count is bounded by concurrently logged-in users platform-wide. */
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

  /** This one user's live sessions, via the `user_sessions:<user_id>` index —
   * O(concurrent logins for this user), not a platform-wide scan. Lazily prunes
   * any jti whose session already expired. */
  async listActiveSessions(userId: string): Promise<IActiveSession[]> {
    const indexKey = this.buildUserIndexKey(userId);
    const jtis = await this.redisClient.smembers(indexKey);
    if (jtis.length === 0) return [];

    const entries = await Promise.all(
      jtis.map(async (jti) => {
        const [session, ttlSeconds] = await Promise.all([
          this.get(jti),
          this.ttl(jti),
        ]);
        return { jti, session, ttlSeconds };
      }),
    );

    const stale = entries.filter((e) => !e.session || e.ttlSeconds <= 0);
    if (stale.length > 0) {
      await this.redisClient.srem(indexKey, ...stale.map((e) => e.jti));
    }

    return entries
      .filter(
        (e): e is { jti: string; session: ISessionData; ttlSeconds: number } =>
          e.session !== null && e.ttlSeconds > 0,
      )
      .map((e) => ({
        jti: e.jti,
        session: e.session,
        ttl_seconds: e.ttlSeconds,
      }));
  }

  async countActiveSessions(userId: string): Promise<number> {
    return (await this.listActiveSessions(userId)).length;
  }

  /** Force-logout every device this user is currently signed in on. Returns the
   * number of sessions killed. */
  async invalidateAllForUser(userId: string): Promise<number> {
    const active = await this.listActiveSessions(userId);
    if (active.length === 0) return 0;

    const pipeline = this.redisClient.pipeline();
    for (const { jti } of active) {
      pipeline.del(this.buildKey(jti));
    }
    pipeline.del(this.buildUserIndexKey(userId));
    await pipeline.exec();
    return active.length;
  }

  /** Overwrites roles/permissions in every active session for this user, in
   * place, preserving each session's remaining TTL — so a revoked permission
   * (or a newly granted one) applies on the user's very next request instead
   * of waiting for their access token to expire and a re-login to happen.
   * Returns the number of sessions updated. */
  async refreshPermissionsForUser(
    userId: string,
    perms: Pick<
      ISessionData,
      'roles' | 'permissions' | 'conditional_permissions'
    >,
  ): Promise<number> {
    const active = await this.listActiveSessions(userId);
    if (active.length === 0) return 0;

    const pipeline = this.redisClient.pipeline();
    for (const { jti, session, ttl_seconds } of active) {
      const merged: ISessionData = { ...session, ...perms };
      pipeline.setex(this.buildKey(jti), ttl_seconds, JSON.stringify(merged));
    }
    await pipeline.exec();
    return active.length;
  }
}
