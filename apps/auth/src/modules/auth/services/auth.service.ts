import { createHash, randomBytes, randomUUID } from 'crypto';

import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';

import * as bcrypt from 'bcrypt';
import { ClientProxy } from '@nestjs/microservices';
import { IsNull, MoreThan, Repository } from 'typeorm';

import { AppMicroservice } from '@lib/common/enum/app-microservice.enum';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import {
  IamMessagePatterns,
  IFindByIdPayload,
  IIamUser,
  IResolvePermissionsPayload,
  IResolvedPermissions,
} from '@lib/common/constants/iam-message-patterns';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { MicroserviceClientService } from '@lib/common/services/microservice-client.service';
import { SessionStoreService } from '@lib/common/services/session-store.service';
import { ConfigService } from '@lib/config';

import { SetCredentialDTO } from '../dto/set-credential.dto';
import { BlockedUser } from '../entities/blocked-user.entity';
import { Credential } from '../entities/credential.entity';
import { LoginHistory } from '../entities/login-history.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { SecurityLog } from '../entities/security-log.entity';
import { parseDurationToSeconds } from '../utils/duration.util';

export interface ILoginResult {
  access_token: string;
  refresh_token: string;
  csrf_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

const MAX_FAILED_ATTEMPTS = 5;
const FAILED_ATTEMPTS_WINDOW_MINUTES = 15;
const AUTO_LOCK_MINUTES = 30;

@Injectable()
export class AuthService {
  constructor(
    private readonly logger: LogsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly microserviceClient: MicroserviceClientService,
    @Inject(AppMicroservice.Iam.name)
    private readonly iamClient: ClientProxy,
    private readonly sessionStore: SessionStoreService,
    @InjectRepository(Credential, ErpDatabases.AUTH)
    private readonly credentialRepository: Repository<Credential>,
    @InjectRepository(RefreshToken, ErpDatabases.AUTH)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(LoginHistory, ErpDatabases.AUTH)
    private readonly loginHistoryRepository: Repository<LoginHistory>,
    @InjectRepository(BlockedUser, ErpDatabases.AUTH)
    private readonly blockedUserRepository: Repository<BlockedUser>,
    @InjectRepository(SecurityLog, ErpDatabases.AUTH)
    private readonly securityLogRepository: Repository<SecurityLog>,
  ) {
    this.logger.setContext(
      `${configService.get<string>('AUTH_PREFIX_NAME')} [auth]`,
      configService.get<string>('AUTH_PREFIX_VERSION'),
    );
  }

  async login(
    username: string,
    password: string,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<ILoginResult> {
    const credential = await this.credentialRepository.findOne({
      where: { username, is_deleted: false },
    });

    if (!credential) {
      await this.recordLoginAttempt(
        null,
        username,
        ipAddress,
        userAgent,
        false,
      );
      throw new UnauthorizedException('Invalid username or password.');
    }

    await this.assertNotBlocked(credential.user_id);

    if (!credential.is_active) {
      await this.recordLoginAttempt(
        credential.user_id,
        username,
        ipAddress,
        userAgent,
        false,
      );
      throw new ForbiddenException('This account has been disabled.');
    }

    const passwordMatches = await bcrypt.compare(
      password,
      credential.password_hash,
    );
    if (!passwordMatches) {
      await this.recordLoginAttempt(
        credential.user_id,
        username,
        ipAddress,
        userAgent,
        false,
      );
      await this.lockAfterTooManyFailures(credential.user_id);
      throw new UnauthorizedException('Invalid username or password.');
    }

    const iamUser = await this.microserviceClient.sendWithContext<
      IIamUser,
      IFindByIdPayload
    >(
      this.logger,
      this.iamClient,
      { cmd: IamMessagePatterns.FindById },
      { user_id: credential.user_id },
    );

    if (!iamUser || iamUser.status !== 'active') {
      await this.recordLoginAttempt(
        credential.user_id,
        username,
        ipAddress,
        userAgent,
        false,
      );
      throw new ForbiddenException('This user account is not active.');
    }

    const resolved = await this.microserviceClient.sendWithContext<
      IResolvedPermissions,
      IResolvePermissionsPayload
    >(
      this.logger,
      this.iamClient,
      { cmd: IamMessagePatterns.ResolvePermissions },
      { user_id: credential.user_id },
      { roles: [], permissions: [], conditional_permissions: [] },
    );

    const result = await this.issueTokens(
      iamUser,
      resolved ?? {
        roles: [],
        permissions: [],
        conditional_permissions: [],
      },
    );

    await this.recordLoginAttempt(
      credential.user_id,
      username,
      ipAddress,
      userAgent,
      true,
    );
    await this.writeSecurityLog(
      'login_success',
      credential.user_id,
      ipAddress,
      null,
    );

    return result;
  }

  async refresh(refreshTokenRaw: string): Promise<ILoginResult> {
    const tokenHash = this.hashToken(refreshTokenRaw);
    const row = await this.refreshTokenRepository.findOne({
      where: {
        token_hash: tokenHash,
        revoked_at: IsNull(),
        expires_at: MoreThan(new Date()),
      },
    });

    if (!row) {
      throw new UnauthorizedException('Refresh token is invalid or expired.');
    }

    row.revoked_at = new Date();
    await this.refreshTokenRepository.save(row);

    const credential = await this.credentialRepository.findOne({
      where: { user_id: row.user_id },
    });
    if (!credential || !credential.is_active) {
      throw new UnauthorizedException('Refresh token is invalid or expired.');
    }

    await this.assertNotBlocked(row.user_id);

    const iamUser = await this.microserviceClient.sendWithContext<
      IIamUser,
      IFindByIdPayload
    >(
      this.logger,
      this.iamClient,
      { cmd: IamMessagePatterns.FindById },
      { user_id: row.user_id },
    );
    if (!iamUser || iamUser.status !== 'active') {
      throw new ForbiddenException('This user account is not active.');
    }

    const resolved = await this.microserviceClient.sendWithContext<
      IResolvedPermissions,
      IResolvePermissionsPayload
    >(
      this.logger,
      this.iamClient,
      { cmd: IamMessagePatterns.ResolvePermissions },
      { user_id: row.user_id },
      { roles: [], permissions: [], conditional_permissions: [] },
    );

    return this.issueTokens(
      iamUser,
      resolved ?? {
        roles: [],
        permissions: [],
        conditional_permissions: [],
      },
    );
  }

  async logout(
    jti: string | null,
    userId: string | null,
    refreshTokenRaw?: string,
  ): Promise<void> {
    if (jti) {
      await this.sessionStore.revoke(jti);
    }
    if (refreshTokenRaw) {
      await this.refreshTokenRepository.update(
        { token_hash: this.hashToken(refreshTokenRaw), revoked_at: IsNull() },
        { revoked_at: new Date() },
      );
    }
    await this.writeSecurityLog('logout', userId, null, null);
  }

  /** Admin flow: creates or resets a user's credential after they're created in iam-bc. */
  async setCredential(
    dto: SetCredentialDTO,
    actingUserId?: string,
  ): Promise<void> {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    let credential = await this.credentialRepository.findOne({
      where: { user_id: dto.user_id },
    });

    if (credential) {
      credential.username = dto.username;
      credential.password_hash = passwordHash;
      credential.is_active = true;
      credential.updated_by = actingUserId ?? null;
    } else {
      credential = this.credentialRepository.create({
        user_id: dto.user_id,
        username: dto.username,
        password_hash: passwordHash,
        is_active: true,
        created_by: actingUserId,
        updated_by: actingUserId,
      });
    }
    await this.credentialRepository.save(credential);
    await this.writeSecurityLog(
      'password_set',
      dto.user_id,
      null,
      `by ${actingUserId ?? 'system'}`,
    );
  }

  private async issueTokens(
    iamUser: IIamUser,
    resolved: IResolvedPermissions,
  ): Promise<ILoginResult> {
    const jti = randomUUID();
    const accessExpiresIn =
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const accessTtlSeconds = parseDurationToSeconds(accessExpiresIn);
    const refreshTtlSeconds = parseDurationToSeconds(refreshExpiresIn);

    // Roles/permissions live in the Redis session blob, not the JWT — keeps the
    // token small and constant-size regardless of how many permissions a user
    // has, and lets an admin revoke effective access mid-token-lifetime.
    const payload: Record<string, unknown> = {
      sub: iamUser.id,
      username: iamUser.username,
      fullname: iamUser.full_name,
      email: iamUser.email,
      jti,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: accessTtlSeconds,
    });

    const refreshTokenRaw = randomBytes(48).toString('hex');
    await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        user_id: iamUser.id,
        token_hash: this.hashToken(refreshTokenRaw),
        expires_at: new Date(Date.now() + refreshTtlSeconds * 1000),
        revoked_at: null,
      }),
    );

    await this.sessionStore.create(
      jti,
      {
        user_id: iamUser.id,
        username: iamUser.username,
        fullname: iamUser.full_name,
        email: iamUser.email,
        roles: resolved.roles,
        permissions: resolved.permissions,
        conditional_permissions: resolved.conditional_permissions,
      },
      accessTtlSeconds,
    );

    return {
      access_token: accessToken,
      refresh_token: refreshTokenRaw,
      // Double-submit CSRF token (see CsrfGuard) — also set as a non-httpOnly
      // cookie by the controller; returned in the body too so non-cookie
      // clients can see the shape, though only the cookie value is checked.
      csrf_token: randomBytes(32).toString('hex'),
      token_type: 'Bearer',
      expires_in: accessTtlSeconds,
    };
  }

  private async assertNotBlocked(userId: string): Promise<void> {
    const active = await this.blockedUserRepository
      .createQueryBuilder('blocked_user')
      .where('blocked_user.user_id = :userId', { userId })
      .andWhere(
        '(blocked_user.blocked_until IS NULL OR blocked_user.blocked_until > now())',
      )
      .orderBy('blocked_user.created_at', 'DESC')
      .getOne();

    if (active) {
      throw new ForbiddenException('This account is currently blocked.');
    }
  }

  private async lockAfterTooManyFailures(userId: string): Promise<void> {
    const since = new Date(
      Date.now() - FAILED_ATTEMPTS_WINDOW_MINUTES * 60 * 1000,
    );
    const recentFailures = await this.loginHistoryRepository.count({
      where: { user_id: userId, is_success: false },
    });

    // Cheap check first; only a range-scoped recount when the cheap check trips, to
    // avoid two count queries on the (much more common) non-locking failure path.
    if (recentFailures < MAX_FAILED_ATTEMPTS) return;

    const recentFailuresInWindow = await this.loginHistoryRepository
      .createQueryBuilder('login_history')
      .where('login_history.user_id = :userId', { userId })
      .andWhere('login_history.is_success = false')
      .andWhere('login_history.logged_in_at > :since', { since })
      .getCount();

    if (recentFailuresInWindow < MAX_FAILED_ATTEMPTS) return;

    await this.blockedUserRepository.save(
      this.blockedUserRepository.create({
        user_id: userId,
        reason: 'Too many failed login attempts',
        blocked_until: new Date(Date.now() + AUTO_LOCK_MINUTES * 60 * 1000),
        blocked_by: null,
      }),
    );
    await this.writeSecurityLog(
      'account_blocked',
      userId,
      null,
      'Too many failed login attempts',
    );
  }

  private async recordLoginAttempt(
    userId: string | null,
    username: string,
    ipAddress: string | null,
    userAgent: string | null,
    isSuccess: boolean,
  ): Promise<void> {
    await this.loginHistoryRepository.save(
      this.loginHistoryRepository.create({
        user_id: userId,
        username,
        ip_address: ipAddress,
        user_agent: userAgent,
        is_success: isSuccess,
        logged_in_at: new Date(),
      }),
    );
    if (!isSuccess) {
      await this.writeSecurityLog(
        'login_failed',
        userId,
        ipAddress,
        `username=${username}`,
      );
    }
  }

  private async writeSecurityLog(
    eventType: string,
    userId: string | null,
    ipAddress: string | null,
    detail: string | null,
  ): Promise<void> {
    await this.securityLogRepository.save(
      this.securityLogRepository.create({
        event_type: eventType,
        user_id: userId,
        ip_address: ipAddress,
        detail,
      }),
    );
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
