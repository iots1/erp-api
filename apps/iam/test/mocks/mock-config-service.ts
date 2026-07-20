import { ConfigService } from '@lib/config';

/**
 * Minimal mock of Nest's ConfigService for the views/* controllers, which only
 * ever call `configService.get<string>(key)`.
 */
export type MockConfigService = {
  get: jest.Mock<string | undefined, [string]>;
};

const DEFAULT_ENV: Record<string, string> = {
  IAM_PREFIX_NAME: 'iam',
  IAM_PREFIX_VERSION: 'v1',
  AUTH_PREFIX_NAME: 'auth',
  AUTH_PREFIX_VERSION: 'v1',
  AUTH_PUBLIC_URL: 'http://localhost:3001',
};

export function createMockConfigService(
  overrides?: Record<string, string>,
): MockConfigService {
  const env = { ...DEFAULT_ENV, ...overrides };

  return {
    get: jest.fn<string | undefined, [string]>((key: string) => env[key]),
  };
}

/** Type-only re-export so spec files can annotate `providers` without importing the real class. */
export type { ConfigService };
