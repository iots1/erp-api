import type { ClientProxy } from '@nestjs/microservices';
import type { JwtService } from '@nestjs/jwt';
import type { Repository } from 'typeorm';

import { ForbiddenException } from '@nestjs/common';

import * as bcryptModule from 'bcrypt';

import { NoOpLogsService } from '@lib/common/modules/log/logs.service';
import type { IIamUser } from '@lib/common/constants/iam-message-patterns';
import type { MicroserviceClientService } from '@lib/common/services/microservice-client.service';
import type {
  ISessionData,
  SessionStoreService,
} from '@lib/common/services/session-store.service';
import { todayDateOnly } from '@lib/common/utils/date-only.util';
import type { ConfigService } from '@lib/config';

import { AuthService } from './auth.service';
import { BlockedUser } from '../entities/blocked-user.entity';
import { Credential } from '../entities/credential.entity';
import { LoginHistory } from '../entities/login-history.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { SecurityLog } from '../entities/security-log.entity';

jest.mock('bcrypt');
const bcrypt = jest.mocked(bcryptModule);

/** Shifts a `YYYY-MM-DD` string by `days` (UTC, calendar-only) — independent
 * of the project's Bangkok-tz date util, so fixtures don't depend on the code
 * under test. Only used for "clearly in the past/future" fixtures; the exact
 * "expires today" boundary case uses {@link todayDateOnly} directly since it
 * must match the SUT's own notion of "today" precisely. */
function shiftDateOnly(dateOnly: string, days: number): string {
  const shifted = new Date(`${dateOnly}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

type MockRepo<T> = {
  findOne: jest.Mock<Promise<T | null>, [unknown]>;
  save: jest.Mock<Promise<T>, [unknown]>;
  create: jest.Mock<T, [unknown]>;
  update: jest.Mock<Promise<unknown>, [unknown, unknown]>;
  count: jest.Mock<Promise<number>, [unknown]>;
  createQueryBuilder: jest.Mock<unknown, [string]>;
};

function createMockRepo<T>(): MockRepo<T> {
  return {
    findOne: jest.fn<Promise<T | null>, [unknown]>(),
    save: jest.fn<Promise<T>, [unknown]>(),
    create: jest.fn<T, [unknown]>((entity) => entity as T),
    update: jest.fn<Promise<unknown>, [unknown, unknown]>(),
    count: jest.fn<Promise<number>, [unknown]>().mockResolvedValue(0),
    createQueryBuilder: jest.fn<unknown, [string]>(),
  };
}

/** Chainable stub matching the `.where().andWhere().orderBy().getOne()` shape
 * `assertNotBlocked` builds off `blockedUserRepository.createQueryBuilder()`. */
function createMockQueryBuilder(getOneResult: unknown) {
  const builder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(getOneResult),
  };
  return builder;
}

function createMockIamUser(overrides?: Partial<IIamUser>): IIamUser {
  return {
    id: 'user-1',
    username: 'jdoe',
    email: 'jdoe@example.com',
    full_name: 'John Doe',
    department: 'IT',
    status: 'active',
    expired_at: null,
    ...overrides,
  };
}

describe('AuthService', () => {
  let credentialRepo: MockRepo<Credential>;
  let refreshTokenRepo: MockRepo<RefreshToken>;
  let loginHistoryRepo: MockRepo<LoginHistory>;
  let blockedUserRepo: MockRepo<BlockedUser>;
  let securityLogRepo: MockRepo<SecurityLog>;
  let sendWithContext: jest.Mock;
  let sessionStoreCreate: jest.Mock<
    Promise<void>,
    [string, ISessionData, number]
  >;
  let jwtSign: jest.Mock<string, [unknown, unknown]>;
  let service: AuthService;

  const CREDENTIAL: Credential = {
    id: 'credential-1',
    user_id: 'user-1',
    username: 'jdoe',
    password_hash: 'hashed-password',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    created_by: null,
    updated_by: null,
    is_deleted: false,
    deleted_reason: null,
    deleted_at: null,
    deleted_by: null,
  };

  beforeEach(() => {
    credentialRepo = createMockRepo<Credential>();
    refreshTokenRepo = createMockRepo<RefreshToken>();
    loginHistoryRepo = createMockRepo<LoginHistory>();
    blockedUserRepo = createMockRepo<BlockedUser>();
    securityLogRepo = createMockRepo<SecurityLog>();

    blockedUserRepo.createQueryBuilder.mockReturnValue(
      createMockQueryBuilder(null),
    );

    sendWithContext = jest.fn();
    sessionStoreCreate = jest.fn<
      Promise<void>,
      [string, ISessionData, number]
    >();
    jwtSign = jest
      .fn<string, [unknown, unknown]>()
      .mockReturnValue('signed.jwt.token');

    bcrypt.compare.mockResolvedValue(true);

    const configService = { get: jest.fn().mockReturnValue(undefined) };
    const microserviceClient = { sendWithContext };
    const sessionStore = { create: sessionStoreCreate };
    const jwtService = { sign: jwtSign };

    service = new AuthService(
      new NoOpLogsService(),
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      microserviceClient as unknown as MicroserviceClientService,
      {} as unknown as ClientProxy,
      sessionStore as unknown as SessionStoreService,
      credentialRepo as unknown as Repository<Credential>,
      refreshTokenRepo as unknown as Repository<RefreshToken>,
      loginHistoryRepo as unknown as Repository<LoginHistory>,
      blockedUserRepo as unknown as Repository<BlockedUser>,
      securityLogRepo as unknown as Repository<SecurityLog>,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /** Wires `sendWithContext` to answer FindById/ResolvePermissions by cmd,
   * matching real IAM responses for the "credentials check out" happy path. */
  function stubIamResponses(iamUser: IIamUser): void {
    sendWithContext.mockImplementation(
      (
        _logger: unknown,
        _client: unknown,
        cmd: { cmd: string },
        _payload: unknown,
        defaultValue: unknown,
      ) => {
        if (cmd.cmd === 'iam.users.find-by-id') {
          return Promise.resolve(iamUser);
        }
        if (cmd.cmd === 'iam.access.resolve-permissions') {
          return Promise.resolve({
            roles: ['ROLE_ADMIN'],
            permissions: ['inventory:read'],
            conditional_permissions: [],
          });
        }
        return Promise.resolve(defaultValue);
      },
    );
  }

  describe('login — account expiry', () => {
    beforeEach(() => {
      credentialRepo.findOne.mockResolvedValue(CREDENTIAL);
    });

    it('rejects with a specific message and records a failed attempt when the account expired yesterday', async () => {
      const iamUser = createMockIamUser({
        expired_at: shiftDateOnly(todayDateOnly(), -1),
      });
      stubIamResponses(iamUser);

      await expect(
        service.login('jdoe', 'password', '127.0.0.1', 'jest'),
      ).rejects.toThrow(
        new ForbiddenException('This user account has expired.'),
      );

      expect(loginHistoryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ is_success: false }),
      );
      // Expiry is rejected before permissions are ever resolved or a session issued.
      expect(sendWithContext).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { cmd: 'iam.access.resolve-permissions' },
        expect.anything(),
        expect.anything(),
      );
      expect(sessionStoreCreate).not.toHaveBeenCalled();
    });

    it('does not treat an account expiring today as already expired (inclusive boundary)', async () => {
      const iamUser = createMockIamUser({ expired_at: todayDateOnly() });
      stubIamResponses(iamUser);

      await expect(
        service.login('jdoe', 'password', '127.0.0.1', 'jest'),
      ).resolves.toBeDefined();

      expect(sessionStoreCreate).toHaveBeenCalledTimes(1);
    });

    it('logs in successfully and carries expired_at into the session when the account expires in the future', async () => {
      const futureDate = shiftDateOnly(todayDateOnly(), 10);
      const iamUser = createMockIamUser({ expired_at: futureDate });
      stubIamResponses(iamUser);

      const result = await service.login(
        'jdoe',
        'password',
        '127.0.0.1',
        'jest',
      );

      expect(result.access_token).toBe('signed.jwt.token');
      expect(sessionStoreCreate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ expired_at: futureDate }),
        expect.any(Number),
      );
    });

    it('logs in successfully and carries a null expired_at into the session (never expires)', async () => {
      const iamUser = createMockIamUser({ expired_at: null });
      stubIamResponses(iamUser);

      await service.login('jdoe', 'password', '127.0.0.1', 'jest');

      expect(sessionStoreCreate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ expired_at: null }),
        expect.any(Number),
      );
    });
  });

  describe('refresh — account expiry', () => {
    const REFRESH_TOKEN_RAW = 'raw-refresh-token';
    const REFRESH_TOKEN_ROW: RefreshToken = {
      id: 'refresh-1',
      user_id: 'user-1',
      token_hash: 'irrelevant-for-this-test',
      expires_at: new Date(Date.now() + 60_000),
      revoked_at: null,
      created_at: new Date(),
      updated_at: new Date(),
      created_by: null,
      updated_by: null,
      is_deleted: false,
      deleted_reason: null,
      deleted_at: null,
      deleted_by: null,
    };

    beforeEach(() => {
      refreshTokenRepo.findOne.mockResolvedValue(REFRESH_TOKEN_ROW);
      credentialRepo.findOne.mockResolvedValue(CREDENTIAL);
    });

    it('rejects with a specific message when the account has expired', async () => {
      const iamUser = createMockIamUser({
        expired_at: shiftDateOnly(todayDateOnly(), -1),
      });
      stubIamResponses(iamUser);

      await expect(service.refresh(REFRESH_TOKEN_RAW)).rejects.toThrow(
        new ForbiddenException('This user account has expired.'),
      );
      expect(sessionStoreCreate).not.toHaveBeenCalled();
    });

    it('succeeds and forwards expired_at into the new session when the account is not expired', async () => {
      const futureDate = shiftDateOnly(todayDateOnly(), 10);
      const iamUser = createMockIamUser({ expired_at: futureDate });
      stubIamResponses(iamUser);

      const result = await service.refresh(REFRESH_TOKEN_RAW);

      expect(result.access_token).toBe('signed.jwt.token');
      expect(sessionStoreCreate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ expired_at: futureDate }),
        expect.any(Number),
      );
    });
  });
});
