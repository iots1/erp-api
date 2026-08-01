import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { ClientProxy } from '@nestjs/microservices';
import { Repository } from 'typeorm';

import type { ICreateInitialCredentialResponse } from '@lib/common/constants/auth-message-patterns';
import { AuthMessagePatterns } from '@lib/common/constants/auth-message-patterns';
import { AppMicroservice } from '@lib/common/enum/app-microservice.enum';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import { IUserSession } from '@lib/common/interfaces/auth.interface';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { MicroserviceClientService } from '@lib/common/services/microservice-client.service';
import { BaseServiceOperations } from '@lib/common/utils/base-operations/base-service-operations.util';
import { mapRelations } from '@lib/common/utils/map-relations.util';
import { ConfigService } from '@lib/config';

import { SessionSyncService } from '../../access/services/session-sync.service';
import { Role } from '../../roles/entities/role.entity';
import { CreateUserDTO } from '../dto/create-user.dto';
import { UpdateUserDTO } from '../dto/update-user.dto';
import { User } from '../entities/user.entity';
import { UserRoleAuditLog } from '../entities/user-role-audit-log.entity';
import { generateTempPassword } from '../utils/generate-temp-password.util';

@Injectable()
export class UsersService extends BaseServiceOperations<
  User,
  CreateUserDTO,
  UpdateUserDTO
> {
  constructor(
    protected readonly logger: LogsService,
    configService: ConfigService,
    @InjectRepository(User, ErpDatabases.IAM)
    userRepository: Repository<User>,
    @InjectRepository(UserRoleAuditLog, ErpDatabases.IAM)
    private readonly auditLogRepository: Repository<UserRoleAuditLog>,
    private readonly sessionSync: SessionSyncService,
    private readonly microserviceClient: MicroserviceClientService,
    @Inject(AppMicroservice.Auth.name)
    private readonly authClient: ClientProxy,
  ) {
    super(userRepository, {
      logging: {
        logger: logger,
        serviceName: configService.get('IAM_PREFIX_NAME'),
        serviceVersion: configService.get('IAM_PREFIX_VERSION'),
      },
    });
  }

  /**
   * Creates the user, then asks auth-bc to mint its initial credential with a
   * randomly-generated password (flagged `must_change_password`). The plaintext
   * password is attached to the returned entity as a transient property —
   * never persisted here, never retrievable again after this response — so the
   * caller (the admin creating this user) can show/copy it exactly once.
   */
  async create(
    data: CreateUserDTO,
    currentUser?: IUserSession | string,
  ): Promise<User> {
    const user = await super.create(data, currentUser);

    const tempPassword = generateTempPassword();
    const createdBy =
      typeof currentUser === 'string' ? currentUser : currentUser?.id;

    const result = await this.microserviceClient.sendWithContext<
      ICreateInitialCredentialResponse,
      {
        user_id: string;
        username: string;
        password: string;
        created_by?: string;
      }
    >(
      this.logger,
      this.authClient,
      { cmd: AuthMessagePatterns.CreateInitialCredential },
      {
        user_id: user.id,
        username: user.username,
        password: tempPassword,
        created_by: createdBy ?? undefined,
      },
    );

    if (!result?.success) {
      this.logger.error(
        `Failed to create initial credential for user ${user.id} — user was created but has no login credential yet.`,
      );
    }

    return Object.assign(user, { temp_password: tempPassword });
  }

  /** Replaces the full set of roles assigned to a user (users_roles join table). */
  async assignRoles(
    userId: string,
    roleIds: string[],
    currentUserId?: string,
  ): Promise<void> {
    await this.executeDbOperation(async () => {
      const user = await this.typeOrmRepository.findOne({
        where: { id: userId },
        relations: ['roles'],
      });
      if (!user) {
        throw new NotFoundException(`User ${userId} not found`);
      }

      const previousIds = new Set(user.roles.map((role) => role.id));
      const nextIds = new Set(roleIds);
      const attached = roleIds.filter((id) => !previousIds.has(id));
      const detached = [...previousIds].filter((id) => !nextIds.has(id));

      user.roles = mapRelations<Role>(roleIds);
      await this.typeOrmRepository.save(user);

      const auditEntries = [
        ...attached.map((roleId) =>
          this.auditLogRepository.create({
            user_id: userId,
            role_id: roleId,
            action: 'attached' as const,
            created_by: currentUserId,
          }),
        ),
        ...detached.map((roleId) =>
          this.auditLogRepository.create({
            user_id: userId,
            role_id: roleId,
            action: 'detached' as const,
            created_by: currentUserId,
          }),
        ),
      ];
      if (auditEntries.length > 0) {
        await this.auditLogRepository.save(auditEntries);
      }
    });
    await this.sessionSync.syncUser(userId);
  }

  async findRoleIds(userId: string): Promise<string[]> {
    const user = await this.typeOrmRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });
    return user?.roles.map((role) => role.id) ?? [];
  }
}
