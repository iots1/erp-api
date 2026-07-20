import * as crypto from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import type { Redis } from 'ioredis';
import { Repository } from 'typeorm';

import type {
  IAccessKeyContext,
  IVerifyAccessKeySignaturePayload,
  IVerifyAccessKeySignatureResponse,
} from '@lib/common/constants/iam-message-patterns';
import { RedisService } from '@lib/common/enum/app-microservice.enum';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import type { IUserSession } from '@lib/common/interfaces/auth.interface';
import { LogsService } from '@lib/common/modules/log/logs.service';
import {
  BaseServiceOperations,
  IUpdateOptions,
} from '@lib/common/utils/base-operations/base-service-operations.util';
import { mapRelations } from '@lib/common/utils/map-relations.util';
import { ConfigService } from '@lib/config';

import { PermissionResolverService } from '../../access/services/permission-resolver.service';
import {
  CreateAccessKeyDTO,
  CreateAccessKeyResponseDTO,
} from '../dto/create-access-key.dto';
import { UpdateAccessKeyDTO } from '../dto/update-access-key.dto';
import { AccessKey } from '../entities/access-key.entity';
import { AccessKeyStatus } from '../enums/access-key-status.enum';
import {
  decryptSecret,
  encryptSecret,
  generateAccessKeyPair,
} from '../utils/key-generator.util';

const KEY_CACHE_TTL_SECONDS = 300;
const CACHE_KEY_PREFIX = 'iam:access_key:';

/** Internal cache/lookup shape — `secret_key_encrypted` never leaves this service. */
interface ICachedAccessKeyRecord {
  id: string;
  access_key_id: string;
  secret_key_encrypted: string;
  name: string;
  owner_id: string;
  owner_type: 'user' | 'service_account';
  status: AccessKeyStatus;
  expires_at: string | null;
  metadata: { ip_whitelist?: string[]; [key: string]: unknown } | null;
}

@Injectable()
export class AccessKeysService extends BaseServiceOperations<
  AccessKey,
  CreateAccessKeyDTO,
  UpdateAccessKeyDTO
> {
  private readonly encryptionKey: string;

  constructor(
    protected readonly logger: LogsService,
    configService: ConfigService,
    @InjectRepository(AccessKey, ErpDatabases.IAM)
    private readonly accessKeyRepository: Repository<AccessKey>,
    @Inject(RedisService.name) private readonly redis: Redis,
    private readonly permissionResolver: PermissionResolverService,
  ) {
    super(accessKeyRepository, {
      logging: {
        logger,
        serviceName: configService.get('IAM_PREFIX_NAME'),
        serviceVersion: configService.get('IAM_PREFIX_VERSION'),
      },
    });

    const key = configService.get<string>('ACCESS_KEY_SECRET_ENCRYPTION_KEY');
    if (!key || key.length !== 64) {
      throw new Error(
        'ACCESS_KEY_SECRET_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)',
      );
    }
    this.encryptionKey = key;
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────

  /**
   * Generates a new Access Key/Secret Key pair and stores the secret encrypted.
   * The plaintext secret is returned here only — it is never persisted or
   * retrievable again after this call.
   */
  async issue(
    dto: CreateAccessKeyDTO,
    currentUser?: IUserSession | string,
  ): Promise<CreateAccessKeyResponseDTO> {
    const { access_key_id, secret_key } = generateAccessKeyPair();
    const secret_key_encrypted = encryptSecret(secret_key, this.encryptionKey);
    const userId =
      currentUser === undefined
        ? undefined
        : typeof currentUser === 'string'
          ? currentUser
          : (currentUser.id ?? undefined);

    const saved = await this.executeDbOperation(() => {
      const entity = this.accessKeyRepository.create({
        access_key_id,
        secret_key_encrypted,
        owner_id: dto.owner_id,
        owner_type: dto.owner_type,
        name: dto.name,
        description: dto.description ?? null,
        status: AccessKeyStatus.ACTIVE,
        expires_at: dto.expires_at ? new Date(dto.expires_at) : null,
        metadata: dto.metadata ?? null,
      });
      if (userId !== undefined) {
        entity.created_by = userId;
        entity.updated_by = userId;
      }
      return this.accessKeyRepository.save(entity);
    });

    return {
      id: saved.id,
      access_key_id: saved.access_key_id,
      secret_key,
      name: saved.name,
      status: saved.status,
      expires_at: saved.expires_at?.toISOString() ?? null,
    };
  }

  async update(
    id: string,
    data: UpdateAccessKeyDTO,
    currentUser?: IUserSession | string,
    options?: IUpdateOptions,
  ): Promise<AccessKey> {
    const existing = await this.findById(id);
    const normalized: Record<string, unknown> = { ...data };
    if (data.expires_at !== undefined) {
      normalized.expires_at = data.expires_at
        ? new Date(data.expires_at)
        : null;
    }
    const updated = await super.update(id, normalized, currentUser, options);
    await this.invalidateCache(existing.access_key_id);
    return updated;
  }

  async delete(
    id: string | number,
    softDelete = true,
    currentUser?: IUserSession | string,
  ): Promise<void> {
    const existing = await this.findById(id);
    await super.delete(id, softDelete, currentUser);
    await this.invalidateCache(existing.access_key_id);
  }

  /** Permanently revoke — irreversible, distinct from `update({ status })` for auditability. */
  async revoke(id: string, currentUser?: IUserSession | string): Promise<void> {
    const key = await this.findById(id);
    key.status = AccessKeyStatus.REVOKED;
    const userId =
      currentUser === undefined
        ? undefined
        : typeof currentUser === 'string'
          ? currentUser
          : (currentUser.id ?? undefined);
    if (userId !== undefined) key.updated_by = userId;

    await this.executeDbOperation(() => this.accessKeyRepository.save(key));
    await this.invalidateCache(key.access_key_id);
  }

  /** Replaces the full set of policies attached to an access key (access_keys_policies join table). */
  async attachPolicies(
    accessKeyId: string,
    policyIds: string[],
  ): Promise<void> {
    const key = await this.findById(accessKeyId, ['policies']);
    await this.executeDbOperation(() => {
      key.policies = mapRelations(policyIds);
      return this.accessKeyRepository.save(key);
    });
    await this.invalidateCache(key.access_key_id);
  }

  async findPolicyIds(accessKeyId: string): Promise<string[]> {
    const key = await this.findById(accessKeyId, ['policies']);
    return key.policies.map((policy) => policy.id);
  }

  // ─── RPC: verifySignature ─────────────────────────────────────────────────

  async verifySignature(
    request: IVerifyAccessKeySignaturePayload,
  ): Promise<IVerifyAccessKeySignatureResponse> {
    const { access_key_id, string_to_sign, provided_signature, source_ip } =
      request;

    const record = await this.getCachedRecord(access_key_id);
    if (!record) {
      return { valid: false, context: null, reason: 'Access Key not found' };
    }

    if (record.status !== AccessKeyStatus.ACTIVE) {
      return {
        valid: false,
        context: null,
        reason: `Access Key is ${record.status}`,
      };
    }

    if (
      record.expires_at !== null &&
      new Date(record.expires_at) < new Date()
    ) {
      return { valid: false, context: null, reason: 'Access Key has expired' };
    }

    const ipWhitelist = record.metadata?.ip_whitelist;
    if (ipWhitelist && ipWhitelist.length > 0) {
      if (source_ip === null || !ipWhitelist.includes(source_ip)) {
        return {
          valid: false,
          context: null,
          reason: 'Request from unauthorized IP address',
        };
      }
    }

    const secretKey = decryptSecret(
      record.secret_key_encrypted,
      this.encryptionKey,
    );
    if (!this.verifyHmac(string_to_sign, secretKey, provided_signature)) {
      return { valid: false, context: null, reason: 'Invalid signature' };
    }

    const policyIds = await this.findPolicyIds(record.id);
    const { permissions, conditional_permissions } =
      await this.permissionResolver.resolveForPolicyIds(policyIds);

    // Non-blocking — a failed timestamp update must never fail the auth call.
    this.accessKeyRepository
      .update({ access_key_id }, { last_used_at: new Date() })
      .catch(() => {});

    const context: IAccessKeyContext = {
      id: record.id,
      access_key_id: record.access_key_id,
      name: record.name,
      owner_id: record.owner_id,
      owner_type: record.owner_type,
      permissions,
      conditional_permissions,
    };

    return { valid: true, context };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Fetches the access key record (including the encrypted secret, which the
   * entity marks `select: false` by default) from Redis, falling back to the DB.
   */
  private async getCachedRecord(
    access_key_id: string,
  ): Promise<ICachedAccessKeyRecord | null> {
    const cacheKey = `${CACHE_KEY_PREFIX}${access_key_id}`;

    const cached = await this.redis.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached) as ICachedAccessKeyRecord;
    }

    const key = await this.accessKeyRepository
      .createQueryBuilder('access_key')
      .addSelect('access_key.secret_key_encrypted')
      .where('access_key.access_key_id = :access_key_id', { access_key_id })
      .andWhere('access_key.is_deleted = false')
      .getOne();

    if (!key) return null;

    const record: ICachedAccessKeyRecord = {
      id: key.id,
      access_key_id: key.access_key_id,
      secret_key_encrypted: key.secret_key_encrypted,
      name: key.name,
      owner_id: key.owner_id,
      owner_type: key.owner_type,
      status: key.status,
      expires_at: key.expires_at ? key.expires_at.toISOString() : null,
      metadata: key.metadata,
    };

    await this.redis.setex(
      cacheKey,
      KEY_CACHE_TTL_SECONDS,
      JSON.stringify(record),
    );
    return record;
  }

  private async invalidateCache(access_key_id: string): Promise<void> {
    await this.redis.del(`${CACHE_KEY_PREFIX}${access_key_id}`);
  }

  /** HMAC-SHA256, constant-time compare (prevents timing attacks). */
  private verifyHmac(
    stringToSign: string,
    secretKey: string,
    provided: string,
  ): boolean {
    try {
      const expected = crypto
        .createHmac('sha256', secretKey)
        .update(stringToSign)
        .digest('hex');

      if (provided.length !== expected.length) return false;
      return crypto.timingSafeEqual(
        Buffer.from(provided),
        Buffer.from(expected),
      );
    } catch {
      return false;
    }
  }
}
