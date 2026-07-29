import type { ExecutionContext } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { Reflector } from '@nestjs/core';

import { UnauthorizedException } from '@nestjs/common';

import type {
  ISessionData,
  SessionStoreService,
} from '@lib/common/services/session-store.service';
import { todayDateOnly } from '@lib/common/utils/date-only.util';

import { AuthGuard, IAuthenticatedRequest } from './auth.guard';

/** Shifts a `YYYY-MM-DD` string by `days` (UTC, calendar-only) — independent
 * of the project's Bangkok-tz date util, so fixtures don't depend on the code
 * under test. Only used for "clearly in the past/future"; the exact "expires
 * today" boundary test uses {@link todayDateOnly} directly since it must
 * match the SUT's own notion of "today" precisely. */
function shiftDateOnly(dateOnly: string, days: number): string {
  const shifted = new Date(`${dateOnly}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

const JTI = 'jti-1';
const TOKEN = 'valid.jwt.token';

function createMockSession(overrides?: Partial<ISessionData>): ISessionData {
  return {
    user_id: 'user-1',
    username: 'jdoe',
    fullname: 'John Doe',
    email: 'jdoe@example.com',
    roles: ['ROLE_ADMIN'],
    permissions: ['inventory:read'],
    conditional_permissions: [],
    expired_at: null,
    ...overrides,
  };
}

function createMockContext(request: Partial<IAuthenticatedRequest>) {
  return {
    getType: jest.fn().mockReturnValue('http'),
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(request),
    }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  let reflectorGetAllAndOverride: jest.Mock<
    boolean | undefined,
    [unknown, unknown[]]
  >;
  let jwtVerify: jest.Mock<unknown, [string]>;
  let sessionStoreGet: jest.Mock<Promise<ISessionData | null>, [string]>;
  let guard: AuthGuard;

  beforeEach(() => {
    reflectorGetAllAndOverride = jest
      .fn<boolean | undefined, [unknown, unknown[]]>()
      .mockReturnValue(false);
    jwtVerify = jest.fn<unknown, [string]>().mockReturnValue({
      sub: 'user-1',
      username: 'jdoe',
      fullname: 'John Doe',
      email: 'jdoe@example.com',
      jti: JTI,
    });
    sessionStoreGet = jest.fn<Promise<ISessionData | null>, [string]>();

    const reflector = { getAllAndOverride: reflectorGetAllAndOverride };
    const jwtService = { verify: jwtVerify };
    const sessionStore = { get: sessionStoreGet };

    guard = new AuthGuard(
      reflector as unknown as Reflector,
      jwtService as unknown as JwtService,
      sessionStore as unknown as SessionStoreService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('account expiry (session.expired_at)', () => {
    it('rejects a request whose account expired yesterday, even with an otherwise-valid session', async () => {
      sessionStoreGet.mockResolvedValue(
        createMockSession({ expired_at: shiftDateOnly(todayDateOnly(), -1) }),
      );
      const request: Partial<IAuthenticatedRequest> = {
        headers: { authorization: `Bearer ${TOKEN}` },
        cookies: {},
      };
      const context = createMockContext(request);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException(
          'This user account has expired. Please contact your administrator.',
        ),
      );
      expect(request.user).toBeUndefined();
    });

    it('does not treat an account expiring today as already expired (inclusive boundary)', async () => {
      sessionStoreGet.mockResolvedValue(
        createMockSession({ expired_at: todayDateOnly() }),
      );
      const request: Partial<IAuthenticatedRequest> = {
        headers: { authorization: `Bearer ${TOKEN}` },
        cookies: {},
      };
      const context = createMockContext(request);

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(request.user?.user_session.id).toBe('user-1');
    });

    it('allows a request whose account expires in the future', async () => {
      sessionStoreGet.mockResolvedValue(
        createMockSession({ expired_at: shiftDateOnly(todayDateOnly(), 10) }),
      );
      const request: Partial<IAuthenticatedRequest> = {
        headers: { authorization: `Bearer ${TOKEN}` },
        cookies: {},
      };
      const context = createMockContext(request);

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it('allows a request whose account never expires (expired_at null)', async () => {
      sessionStoreGet.mockResolvedValue(
        createMockSession({ expired_at: null }),
      );
      const request: Partial<IAuthenticatedRequest> = {
        headers: { authorization: `Bearer ${TOKEN}` },
        cookies: {},
      };
      const context = createMockContext(request);

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });
  });

  describe('interaction with existing session-revocation handling', () => {
    it('still rejects a revoked (missing) session before ever checking expiry', async () => {
      sessionStoreGet.mockResolvedValue(null);
      const request: Partial<IAuthenticatedRequest> = {
        headers: { authorization: `Bearer ${TOKEN}` },
        cookies: {},
      };
      const context = createMockContext(request);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException(
          'Session has been revoked. Please log in again.',
        ),
      );
    });
  });
});
