import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import Redis from 'ioredis';
import { In, IsNull, Repository } from 'typeorm';

import { RedisService } from '@lib/common/enum/app-microservice.enum';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import { IResponsePaginatedService } from '@lib/common/interfaces/response/response-service.interface';

import { Credential } from '../entities/credential.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { SecurityLog } from '../entities/security-log.entity';

const SESSION_KEY_PREFIX = 'session:';
const SESSION_SCAN_COUNT = 200;

/**
 * Reads/revokes live sessions. Sessions live only in Redis (`session:<jti>` →
 * user_id, TTL = access-token lifetime, written by AuthService.issueTokens) —
 * there is no per-user index, so listing means scanning the keyspace. Fine for
 * an admin tool; the key count is bounded by concurrently logged-in users.
 */
@Injectable()
export class SessionsService {
  constructor(
    @Inject(RedisService.name)
    private readonly redisClient: Redis,
    @InjectRepository(Credential, ErpDatabases.AUTH)
    private readonly credentialRepository: Repository<Credential>,
    @InjectRepository(RefreshToken, ErpDatabases.AUTH)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(SecurityLog, ErpDatabases.AUTH)
    private readonly securityLogRepository: Repository<SecurityLog>,
  ) {}

  async findActive(page = 1, limit = 20): Promise<
    IResponsePaginatedService<
      Array<{
        jti: string;
        user_id: string;
        username: string | null;
        ttl_seconds: number;
        expires_at: Date;
      }>
    >
  > {
    const keys = await this.scanAllSessionKeys();
    const total = keys.length;
    const safeLimit = Math.max(1, limit);
    const safePage = Math.max(1, page);
    const pageKeys = keys.slice(
      (safePage - 1) * safeLimit,
      safePage * safeLimit,
    );

    const entries = await Promise.all(
      pageKeys.map(async (key) => {
        const [userId, ttlSeconds] = await Promise.all([
          this.redisClient.get(key),
          this.redisClient.ttl(key),
        ]);
        return { key, userId, ttlSeconds };
      }),
    );

    const userIds = [
      ...new Set(entries.map((e) => e.userId).filter((id): id is string => Boolean(id))),
    ];
    const credentials = userIds.length
      ? await this.credentialRepository.find({ where: { user_id: In(userIds) } })
      : [];
    const usernameByUserId = new Map(credentials.map((c) => [c.user_id, c.username]));

    const data = entries
      .filter((e) => e.userId && e.ttlSeconds > 0)
      .map((e) => ({
        jti: e.key.slice(SESSION_KEY_PREFIX.length),
        user_id: e.userId as string,
        username: usernameByUserId.get(e.userId as string) ?? null,
        ttl_seconds: e.ttlSeconds,
        expires_at: new Date(Date.now() + e.ttlSeconds * 1000),
      }));

    return {
      data,
      pagination: {
        page: safePage,
        page_size: safeLimit,
        total,
        total_records: total,
        total_pages: Math.max(1, Math.ceil(total / safeLimit)),
      },
    };
  }

  /** Kills a session immediately (Redis key) and revokes every active refresh
   * token for its owner, so the client can't silently mint a new access token. */
  async revoke(jti: string, revokedBy: string | null): Promise<void> {
    const key = `${SESSION_KEY_PREFIX}${jti}`;
    const userId = await this.redisClient.get(key);
    if (!userId) {
      throw new NotFoundException(`Session '${jti}' not found or already expired.`);
    }

    await this.redisClient.del(key);
    await this.refreshTokenRepository.update(
      { user_id: userId, revoked_at: IsNull() },
      { revoked_at: new Date() },
    );

    await this.securityLogRepository.save(
      this.securityLogRepository.create({
        event_type: 'session_revoked_by_admin',
        user_id: userId,
        ip_address: null,
        detail: `session ${jti} revoked by ${revokedBy ?? 'unknown admin'}`,
      }),
    );
  }

  private async scanAllSessionKeys(): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, batch] = await this.redisClient.scan(
        cursor,
        'MATCH',
        `${SESSION_KEY_PREFIX}*`,
        'COUNT',
        SESSION_SCAN_COUNT,
      );
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');
    return keys;
  }
}
