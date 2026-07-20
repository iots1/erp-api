import type { IUserSession } from '@lib/common/interfaces/auth.interface';

export const MOCK_USER_ID = 'a1b2c3d4-0000-4000-8000-000000000001';

export function createMockUserSession(
  overrides?: Partial<IUserSession>,
): IUserSession {
  return {
    id: MOCK_USER_ID,
    username: 'tester',
    fullname: 'Test User',
    email: 'tester@example.com',
    roles: ['admin'],
    permissions: ['access-key:create', 'access-key:read'],
    jti: 'jti-0001',
    ...overrides,
  };
}
