import * as crypto from 'crypto';

import { NotFoundException } from '@nestjs/common';

import type { Repository } from 'typeorm';

import { ConfigService } from '@lib/config';
import { LogsService } from '@lib/common/modules/log/logs.service';

import {
  createMockAccessKey,
  createMockCreateAccessKeyDTO,
  createMockUpdateAccessKeyDTO,
  MOCK_ACCESS_KEY_UUID,
} from '@apps/iam/test/mocks/mock-access-key';
import { createMockUserSession } from '@apps/iam/test/mocks/mock-user-session';

import { BaseServiceOperations } from '@lib/common/utils/base-operations/base-service-operations.util';

import { AccessKeysService } from '@apps/iam/src/modules/access-keys/services/access-keys.service';
import { AccessKeyStatus } from '@apps/iam/src/modules/access-keys/enums/access-key-status.enum';
import { AccessKey } from '@apps/iam/src/modules/access-keys/entities/access-key.entity';
import * as keyGenerator from '@apps/iam/src/modules/access-keys/utils/key-generator.util';
import { PermissionResolverService } from '@apps/iam/src/modules/access/services/permission-resolver.service';

const VALID_ENCRYPTION_KEY = 'a'.repeat(64);

type MockRepository = {
  create: jest.Mock<AccessKey, [Partial<AccessKey>]>;
  save: jest.Mock<Promise<AccessKey>, [AccessKey]>;
  update: jest.Mock<Promise<unknown>, [unknown, unknown]>;
  createQueryBuilder: jest.Mock<Record<string, jest.Mock>, []>;
  metadata: { tableName: string };
};

type MockRedis = {
  get: jest.Mock<Promise<string | null>, [string]>;
  setex: jest.Mock<Promise<'OK'>, [string, number, string]>;
  del: jest.Mock<Promise<number>, [string]>;
};

type MockPermissionResolverService = {
  resolveForPolicyIds: jest.Mock<
    Promise<{ permissions: string[]; conditional_permissions: string[] }>,
    [string[]]
  >;
};

function createMockRepository(): MockRepository {
  return {
    create: jest.fn<AccessKey, [Partial<AccessKey>]>(
      (data) => data as AccessKey,
    ),
    save: jest.fn<Promise<AccessKey>, [AccessKey]>(),
    update: jest
      .fn<Promise<unknown>, [unknown, unknown]>()
      .mockResolvedValue({}),
    createQueryBuilder: jest.fn<Record<string, jest.Mock>, []>(),
    metadata: { tableName: 'access_keys' },
  };
}

function createMockRedis(): MockRedis {
  return {
    get: jest.fn<Promise<string | null>, [string]>().mockResolvedValue(null),
    setex: jest
      .fn<Promise<'OK'>, [string, number, string]>()
      .mockResolvedValue('OK'),
    del: jest.fn<Promise<number>, [string]>().mockResolvedValue(1),
  };
}

function createMockPermissionResolverService(): MockPermissionResolverService {
  return {
    resolveForPolicyIds: jest
      .fn<
        Promise<{ permissions: string[]; conditional_permissions: string[] }>,
        [string[]]
      >()
      .mockResolvedValue({
        permissions: ['inventory:read'],
        conditional_permissions: [],
      }),
  };
}

function createMockConfigService(
  overrides?: Record<string, string>,
): ConfigService {
  const values: Record<string, string> = {
    IAM_PREFIX_NAME: 'iam',
    IAM_PREFIX_VERSION: '1.0.0',
    ACCESS_KEY_SECRET_ENCRYPTION_KEY: VALID_ENCRYPTION_KEY,
    ...overrides,
  };
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function createMockLogsService(): LogsService {
  return {
    setContext: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
  } as unknown as LogsService;
}

describe('AccessKeysService', () => {
  let mockRepository: MockRepository;
  let mockRedis: MockRedis;
  let mockPermissionResolver: MockPermissionResolverService;
  let service: AccessKeysService;

  beforeEach(() => {
    mockRepository = createMockRepository();
    mockRedis = createMockRedis();
    mockPermissionResolver = createMockPermissionResolverService();

    service = new AccessKeysService(
      createMockLogsService(),
      createMockConfigService(),
      mockRepository as unknown as Repository<AccessKey>,
      mockRedis as unknown as import('ioredis').Redis,
      mockPermissionResolver as unknown as PermissionResolverService,
    );

    jest.spyOn(service, 'findById');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('throws when ACCESS_KEY_SECRET_ENCRYPTION_KEY is missing', () => {
      expect(
        () =>
          new AccessKeysService(
            createMockLogsService(),
            createMockConfigService({ ACCESS_KEY_SECRET_ENCRYPTION_KEY: '' }),
            mockRepository as unknown as Repository<AccessKey>,
            mockRedis as unknown as import('ioredis').Redis,
            mockPermissionResolver as unknown as PermissionResolverService,
          ),
      ).toThrow(
        'ACCESS_KEY_SECRET_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)',
      );
    });

    it('throws when ACCESS_KEY_SECRET_ENCRYPTION_KEY has wrong length', () => {
      expect(
        () =>
          new AccessKeysService(
            createMockLogsService(),
            createMockConfigService({
              ACCESS_KEY_SECRET_ENCRYPTION_KEY: 'short',
            }),
            mockRepository as unknown as Repository<AccessKey>,
            mockRedis as unknown as import('ioredis').Redis,
            mockPermissionResolver as unknown as PermissionResolverService,
          ),
      ).toThrow(
        'ACCESS_KEY_SECRET_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)',
      );
    });
  });

  describe('issue', () => {
    it('generates a key pair, encrypts the secret, and returns the plaintext secret once', async () => {
      const dto = createMockCreateAccessKeyDTO();
      const savedEntity = createMockAccessKey({
        owner_id: dto.owner_id,
        name: dto.name,
      });
      mockRepository.save.mockResolvedValue(savedEntity);

      const currentUser = createMockUserSession();
      const result = await service.issue(dto, currentUser);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          owner_id: dto.owner_id,
          owner_type: dto.owner_type,
          name: dto.name,
          status: AccessKeyStatus.ACTIVE,
        }),
      );
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.id).toBe(savedEntity.id);
      expect(result.access_key_id).toBe(savedEntity.access_key_id);
      expect(typeof result.secret_key).toBe('string');
      expect(result.secret_key.length).toBeGreaterThan(0);
    });

    it('stamps created_by/updated_by when currentUser is a string id', async () => {
      const dto = createMockCreateAccessKeyDTO();
      mockRepository.save.mockImplementation((entity: AccessKey) =>
        Promise.resolve(entity),
      );

      await service.issue(dto, 'user-string-id');

      const createdEntity = mockRepository.create.mock.results[0]
        ?.value as AccessKey;
      expect(createdEntity.created_by).toBe('user-string-id');
      expect(createdEntity.updated_by).toBe('user-string-id');
    });

    it('does not stamp created_by/updated_by when currentUser is undefined', async () => {
      const dto = createMockCreateAccessKeyDTO();
      mockRepository.save.mockImplementation((entity: AccessKey) =>
        Promise.resolve(entity),
      );

      await service.issue(dto);

      const createdEntity = mockRepository.create.mock.results[0]
        ?.value as AccessKey;
      expect(createdEntity.created_by).toBeUndefined();
    });

    it('defaults description/metadata to null and sets expires_at from dto', async () => {
      const dto = createMockCreateAccessKeyDTO({
        description: undefined,
        metadata: undefined,
        expires_at: '2027-01-01T00:00:00.000Z',
      });
      mockRepository.save.mockImplementation((entity: AccessKey) =>
        Promise.resolve(entity),
      );

      await service.issue(dto);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: null,
          metadata: null,
          expires_at: new Date('2027-01-01T00:00:00.000Z'),
        }),
      );
    });
  });

  describe('update', () => {
    it('normalizes expires_at, delegates to base update, and invalidates cache', async () => {
      const existing = createMockAccessKey();
      jest.spyOn(service, 'findById').mockResolvedValue(existing);
      const updated = createMockAccessKey({ name: 'New Name' });
      const superUpdateSpy = jest
        .spyOn(BaseServiceOperations.prototype, 'update')
        .mockResolvedValue(updated);

      const dto = createMockUpdateAccessKeyDTO({
        expires_at: '2027-06-01T00:00:00.000Z',
      });
      const result = await service.update(
        MOCK_ACCESS_KEY_UUID,
        dto,
        createMockUserSession(),
      );

      expect(result).toBe(updated);
      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining(existing.access_key_id),
      );
      superUpdateSpy.mockRestore();
    });

    it('sets expires_at to null when dto.expires_at is explicitly null', async () => {
      const existing = createMockAccessKey();
      jest.spyOn(service, 'findById').mockResolvedValue(existing);
      const superUpdateSpy = jest
        .spyOn(BaseServiceOperations.prototype, 'update')
        .mockResolvedValue(existing);

      await service.update(
        MOCK_ACCESS_KEY_UUID,
        createMockUpdateAccessKeyDTO({ expires_at: null }),
        createMockUserSession(),
      );

      expect(superUpdateSpy).toHaveBeenCalledWith(
        MOCK_ACCESS_KEY_UUID,
        expect.objectContaining({ expires_at: null }),
        expect.anything(),
        undefined,
      );
      superUpdateSpy.mockRestore();
    });

    it('propagates NotFoundException when the key does not exist', async () => {
      jest
        .spyOn(service, 'findById')
        .mockRejectedValue(new NotFoundException('access_keys not found'));

      await expect(
        service.update('missing-id', createMockUpdateAccessKeyDTO()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('loads the existing key, delegates to base delete, and invalidates cache', async () => {
      const existing = createMockAccessKey();
      jest.spyOn(service, 'findById').mockResolvedValue(existing);
      const superDeleteSpy = jest
        .spyOn(BaseServiceOperations.prototype, 'delete')
        .mockResolvedValue(undefined);

      await service.delete(MOCK_ACCESS_KEY_UUID, true, createMockUserSession());

      expect(superDeleteSpy).toHaveBeenCalledWith(
        MOCK_ACCESS_KEY_UUID,
        true,
        expect.anything(),
      );
      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining(existing.access_key_id),
      );
      superDeleteSpy.mockRestore();
    });

    it('throws NotFoundException when the key does not exist', async () => {
      jest
        .spyOn(service, 'findById')
        .mockRejectedValue(new NotFoundException('access_keys not found'));

      await expect(service.delete('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('revoke', () => {
    it('sets status to REVOKED, saves, and invalidates cache', async () => {
      const existing = createMockAccessKey({ status: AccessKeyStatus.ACTIVE });
      jest.spyOn(service, 'findById').mockResolvedValue(existing);
      mockRepository.save.mockResolvedValue({
        ...existing,
        status: AccessKeyStatus.REVOKED,
      });

      await service.revoke(MOCK_ACCESS_KEY_UUID, createMockUserSession());

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AccessKeyStatus.REVOKED }),
      );
      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining(existing.access_key_id),
      );
    });

    it('stamps updated_by from a string currentUser', async () => {
      const existing = createMockAccessKey();
      jest.spyOn(service, 'findById').mockResolvedValue(existing);
      mockRepository.save.mockImplementation((entity: AccessKey) =>
        Promise.resolve(entity),
      );

      await service.revoke(MOCK_ACCESS_KEY_UUID, 'string-user-id');

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ updated_by: 'string-user-id' }),
      );
    });

    it('throws NotFoundException when the key does not exist', async () => {
      jest
        .spyOn(service, 'findById')
        .mockRejectedValue(new NotFoundException('access_keys not found'));

      await expect(service.revoke('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('attachPolicies', () => {
    it('replaces policies and invalidates cache', async () => {
      const existing = createMockAccessKey({ policies: [] });
      const findByIdSpy = jest
        .spyOn(service, 'findById')
        .mockResolvedValue(existing);
      mockRepository.save.mockImplementation((entity: AccessKey) =>
        Promise.resolve(entity),
      );

      const policyIds = ['policy-1', 'policy-2'];
      await service.attachPolicies(MOCK_ACCESS_KEY_UUID, policyIds);

      expect(findByIdSpy).toHaveBeenCalledWith(MOCK_ACCESS_KEY_UUID, [
        'policies',
      ]);
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          policies: [{ id: 'policy-1' }, { id: 'policy-2' }],
        }),
      );
      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining(existing.access_key_id),
      );
    });
  });

  describe('findPolicyIds', () => {
    it('returns the ids of attached policies', async () => {
      const existing = createMockAccessKey({
        policies: [
          { id: 'policy-1' },
          { id: 'policy-2' },
        ] as AccessKey['policies'],
      });
      jest.spyOn(service, 'findById').mockResolvedValue(existing);

      const result = await service.findPolicyIds(MOCK_ACCESS_KEY_UUID);

      expect(result).toEqual(['policy-1', 'policy-2']);
    });
  });

  describe('verifySignature', () => {
    const buildQueryBuilder = (
      result: AccessKey | null,
    ): Record<string, jest.Mock> => {
      const qb: Record<string, jest.Mock> = {};
      qb.addSelect = jest.fn().mockReturnValue(qb);
      qb.where = jest.fn().mockReturnValue(qb);
      qb.andWhere = jest.fn().mockReturnValue(qb);
      qb.getOne = jest.fn().mockResolvedValue(result);
      return qb;
    };

    function signPayload(stringToSign: string, secret: string): string {
      return crypto
        .createHmac('sha256', secret)
        .update(stringToSign)
        .digest('hex');
    }

    it('returns valid:false when the key is not found (cache miss + DB miss)', async () => {
      mockRepository.createQueryBuilder.mockReturnValue(
        buildQueryBuilder(null),
      );

      const result = await service.verifySignature({
        access_key_id: 'AKIA_UNKNOWN',
        string_to_sign: 'GET\n/x\n123\nhash',
        provided_signature: 'whatever',
        source_ip: null,
      });

      expect(result).toEqual({
        valid: false,
        context: null,
        reason: 'Access Key not found',
      });
    });

    it('returns valid:false when the key status is not ACTIVE', async () => {
      const secretKey = 'plaintext-secret';
      const encrypted = keyGenerator.encryptSecret(
        secretKey,
        VALID_ENCRYPTION_KEY,
      );
      const key = createMockAccessKey({
        status: AccessKeyStatus.INACTIVE,
        secret_key_encrypted: encrypted,
      });
      mockRepository.createQueryBuilder.mockReturnValue(buildQueryBuilder(key));

      const stringToSign = 'GET\n/x\n123\nhash';
      const result = await service.verifySignature({
        access_key_id: key.access_key_id,
        string_to_sign: stringToSign,
        provided_signature: signPayload(stringToSign, secretKey),
        source_ip: null,
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Access Key is inactive');
    });

    it('returns valid:false when the key has expired', async () => {
      const key = createMockAccessKey({
        expires_at: new Date('2000-01-01T00:00:00.000Z'),
      });
      mockRepository.createQueryBuilder.mockReturnValue(buildQueryBuilder(key));

      const result = await service.verifySignature({
        access_key_id: key.access_key_id,
        string_to_sign: 'GET\n/x\n123\nhash',
        provided_signature: 'sig',
        source_ip: null,
      });

      expect(result).toEqual({
        valid: false,
        context: null,
        reason: 'Access Key has expired',
      });
    });

    it('returns valid:false when source_ip is not in the whitelist', async () => {
      const key = createMockAccessKey({
        metadata: { ip_whitelist: ['10.0.0.1'] },
      });
      mockRepository.createQueryBuilder.mockReturnValue(buildQueryBuilder(key));

      const result = await service.verifySignature({
        access_key_id: key.access_key_id,
        string_to_sign: 'GET\n/x\n123\nhash',
        provided_signature: 'sig',
        source_ip: '10.0.0.2',
      });

      expect(result).toEqual({
        valid: false,
        context: null,
        reason: 'Request from unauthorized IP address',
      });
    });

    it('returns valid:false when source_ip is null but a whitelist is configured', async () => {
      const key = createMockAccessKey({
        metadata: { ip_whitelist: ['10.0.0.1'] },
      });
      mockRepository.createQueryBuilder.mockReturnValue(buildQueryBuilder(key));

      const result = await service.verifySignature({
        access_key_id: key.access_key_id,
        string_to_sign: 'GET\n/x\n123\nhash',
        provided_signature: 'sig',
        source_ip: null,
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Request from unauthorized IP address');
    });

    it('allows when source_ip is in the whitelist', async () => {
      const secretKey = 'plaintext-secret';
      const encrypted = keyGenerator.encryptSecret(
        secretKey,
        VALID_ENCRYPTION_KEY,
      );
      const key = createMockAccessKey({
        metadata: { ip_whitelist: ['10.0.0.1'] },
        policies: [],
      });
      key.secret_key_encrypted = encrypted;
      mockRepository.createQueryBuilder.mockReturnValue(buildQueryBuilder(key));
      jest.spyOn(service, 'findById').mockResolvedValue(key);

      const stringToSign = 'GET\n/x\n123\nhash';
      const result = await service.verifySignature({
        access_key_id: key.access_key_id,
        string_to_sign: stringToSign,
        provided_signature: signPayload(stringToSign, secretKey),
        source_ip: '10.0.0.1',
      });

      expect(result.valid).toBe(true);
    });

    it('returns valid:false when the HMAC signature does not match', async () => {
      const secretKey = 'plaintext-secret';
      const encrypted = keyGenerator.encryptSecret(
        secretKey,
        VALID_ENCRYPTION_KEY,
      );
      const key = createMockAccessKey({ secret_key_encrypted: encrypted });
      mockRepository.createQueryBuilder.mockReturnValue(buildQueryBuilder(key));

      const result = await service.verifySignature({
        access_key_id: key.access_key_id,
        string_to_sign: 'GET\n/x\n123\nhash',
        provided_signature: 'not-a-real-signature',
        source_ip: null,
      });

      expect(result).toEqual({
        valid: false,
        context: null,
        reason: 'Invalid signature',
      });
    });

    it('returns valid:false when the provided signature has a different length than expected (timing-safe short-circuit)', async () => {
      const secretKey = 'plaintext-secret';
      const encrypted = keyGenerator.encryptSecret(
        secretKey,
        VALID_ENCRYPTION_KEY,
      );
      const key = createMockAccessKey({ secret_key_encrypted: encrypted });
      mockRepository.createQueryBuilder.mockReturnValue(buildQueryBuilder(key));

      const result = await service.verifySignature({
        access_key_id: key.access_key_id,
        string_to_sign: 'GET\n/x\n123\nhash',
        provided_signature: 'short',
        source_ip: null,
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Invalid signature');
    });

    it('succeeds on a valid signature, resolves permissions, updates last_used_at, and builds context', async () => {
      const secretKey = 'plaintext-secret';
      const encrypted = keyGenerator.encryptSecret(
        secretKey,
        VALID_ENCRYPTION_KEY,
      );
      const key = createMockAccessKey({
        secret_key_encrypted: encrypted,
        policies: [],
      });
      mockRepository.createQueryBuilder.mockReturnValue(buildQueryBuilder(key));
      jest.spyOn(service, 'findById').mockResolvedValue(key);
      mockPermissionResolver.resolveForPolicyIds.mockResolvedValue({
        permissions: ['inventory:read'],
        conditional_permissions: ['inventory:approve'],
      });

      const stringToSign = 'POST\n/orders\n1700000000\nabc123';
      const result = await service.verifySignature({
        access_key_id: key.access_key_id,
        string_to_sign: stringToSign,
        provided_signature: signPayload(stringToSign, secretKey),
        source_ip: null,
      });

      expect(result.valid).toBe(true);
      expect(result.context).toEqual({
        id: key.id,
        access_key_id: key.access_key_id,
        name: key.name,
        owner_id: key.owner_id,
        owner_type: key.owner_type,
        permissions: ['inventory:read'],
        conditional_permissions: ['inventory:approve'],
      });

      const expectedLastUsedAt: unknown = expect.any(Date);
      expect(mockRepository.update).toHaveBeenCalledWith(
        { access_key_id: key.access_key_id },
        expect.objectContaining({ last_used_at: expectedLastUsedAt }),
      );
    });

    it('does not fail verification when the last_used_at update rejects', async () => {
      const secretKey = 'plaintext-secret';
      const encrypted = keyGenerator.encryptSecret(
        secretKey,
        VALID_ENCRYPTION_KEY,
      );
      const key = createMockAccessKey({
        secret_key_encrypted: encrypted,
        policies: [],
      });
      mockRepository.createQueryBuilder.mockReturnValue(buildQueryBuilder(key));
      jest.spyOn(service, 'findById').mockResolvedValue(key);
      mockRepository.update.mockReturnValue(
        Promise.reject(new Error('db down')),
      );

      const stringToSign = 'POST\n/orders\n1700000000\nabc123';
      const result = await service.verifySignature({
        access_key_id: key.access_key_id,
        string_to_sign: stringToSign,
        provided_signature: signPayload(stringToSign, secretKey),
        source_ip: null,
      });

      expect(result.valid).toBe(true);
    });

    it('reads from the Redis cache instead of the DB on a cache hit', async () => {
      const secretKey = 'plaintext-secret';
      const encrypted = keyGenerator.encryptSecret(
        secretKey,
        VALID_ENCRYPTION_KEY,
      );
      const key = createMockAccessKey({
        secret_key_encrypted: encrypted,
        policies: [],
      });
      mockRedis.get.mockResolvedValue(
        JSON.stringify({
          id: key.id,
          access_key_id: key.access_key_id,
          secret_key_encrypted: key.secret_key_encrypted,
          name: key.name,
          owner_id: key.owner_id,
          owner_type: key.owner_type,
          status: key.status,
          expires_at: null,
          metadata: null,
        }),
      );
      jest.spyOn(service, 'findById').mockResolvedValue(key);

      const stringToSign = 'GET\n/cache-hit\n1700000000\nabc';
      const result = await service.verifySignature({
        access_key_id: key.access_key_id,
        string_to_sign: stringToSign,
        provided_signature: signPayload(stringToSign, secretKey),
        source_ip: null,
      });

      expect(result.valid).toBe(true);
      expect(mockRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('caches the record with the configured TTL on a DB fallback', async () => {
      const secretKey = 'plaintext-secret';
      const encrypted = keyGenerator.encryptSecret(
        secretKey,
        VALID_ENCRYPTION_KEY,
      );
      const key = createMockAccessKey({
        secret_key_encrypted: encrypted,
        policies: [],
      });
      mockRepository.createQueryBuilder.mockReturnValue(buildQueryBuilder(key));
      jest.spyOn(service, 'findById').mockResolvedValue(key);

      const stringToSign = 'GET\n/cache-miss\n1700000000\nabc';
      await service.verifySignature({
        access_key_id: key.access_key_id,
        string_to_sign: stringToSign,
        provided_signature: signPayload(stringToSign, secretKey),
        source_ip: null,
      });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining(key.access_key_id),
        300,
        expect.any(String),
      );
    });
  });
});
