import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { In, IsNull, Repository } from 'typeorm';

import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import { IResponsePaginatedService } from '@lib/common/interfaces/response/response-service.interface';
import { SessionStoreService } from '@lib/common/services/session-store.service';

import { Credential } from '../entities/credential.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { SecurityLog } from '../entities/security-log.entity';

/**
 * Reads/revokes live sessions. Sessions live only in Redis (`session:<jti>` →
 * session blob, TTL = access-token lifetime, written by AuthService.issueTokens) —
 * there is no per-user index, so listing means scanning the keyspace. Fine for
 * an admin tool; the key count is bounded by concurrently logged-in users.
 */
@Injectable()
export class SessionsService {
  constructor(
    private readonly sessionStore: SessionStoreService,
    @InjectRepository(Credential, ErpDatabases.AUTH)
    private readonly credentialRepository: Repository<Credential>,
    @InjectRepository(RefreshToken, ErpDatabases.AUTH)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(SecurityLog, ErpDatabases.AUTH)
    private readonly securityLogRepository: Repository<SecurityLog>,
  ) {}

  async findActive(
    page = 1,
    limit = 20,
  ): Promise<
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
    const keys = await this.sessionStore.scanKeys();
    const total = keys.length;
    const safeLimit = Math.max(1, limit);
    const safePage = Math.max(1, page);
    const pageKeys = keys.slice(
      (safePage - 1) * safeLimit,
      safePage * safeLimit,
    );

    const entries = await Promise.all(
      pageKeys.map(async (key) => {
        const jti = this.sessionStore.jtiFromKey(key);
        const [session, ttlSeconds] = await Promise.all([
          this.sessionStore.get(jti),
          this.sessionStore.ttl(jti),
        ]);
        return { jti, session, ttlSeconds };
      }),
    );

    const userIds = [
      ...new Set(
        entries
          .map((e) => e.session?.user_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const credentials = userIds.length
      ? await this.credentialRepository.find({
          where: { user_id: In(userIds) },
        })
      : [];
    const usernameByUserId = new Map(
      credentials.map((c) => [c.user_id, c.username]),
    );

    const data = entries
      .filter((e) => e.session && e.ttlSeconds > 0)
      .map((e) => ({
        jti: e.jti,
        user_id: e.session!.user_id,
        username: usernameByUserId.get(e.session!.user_id) ?? null,
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

  /** Every device this one user is currently logged in on — via the
   * `user_sessions:<user_id>` index, not a platform-wide scan. */
  async findActiveForUser(userId: string): Promise<{
    id: string;
    user_id: string;
    count: number;
    sessions: Array<{ jti: string; ttl_seconds: number; expires_at: Date }>;
  }> {
    const active = await this.sessionStore.listActiveSessions(userId);
    return {
      id: userId,
      user_id: userId,
      count: active.length,
      sessions: active.map((entry) => ({
        jti: entry.jti,
        ttl_seconds: entry.ttl_seconds,
        expires_at: new Date(Date.now() + entry.ttl_seconds * 1000),
      })),
    };
  }

  /** Kills a session immediately (Redis key) and revokes every active refresh
   * token for its owner, so the client can't silently mint a new access token. */
  async revoke(jti: string, revokedBy: string | null): Promise<void> {
    const session = await this.sessionStore.get(jti);
    if (!session) {
      throw new NotFoundException(
        `Session '${jti}' not found or already expired.`,
      );
    }

    await this.sessionStore.revoke(jti);
    await this.refreshTokenRepository.update(
      { user_id: session.user_id, revoked_at: IsNull() },
      { revoked_at: new Date() },
    );

    await this.securityLogRepository.save(
      this.securityLogRepository.create({
        event_type: 'session_revoked_by_admin',
        user_id: session.user_id,
        ip_address: null,
        detail: `session ${jti} revoked by ${revokedBy ?? 'unknown admin'}`,
      }),
    );
  }
}
