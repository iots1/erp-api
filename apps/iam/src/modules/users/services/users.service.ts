import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { BaseServiceOperations } from '@lib/common/utils/base-operations/base-service-operations.util';
import { mapRelations } from '@lib/common/utils/map-relations.util';
import { ConfigService } from '@lib/config';

import { SessionSyncService } from '../../access/services/session-sync.service';
import { Role } from '../../roles/entities/role.entity';
import { CreateUserDTO } from '../dto/create-user.dto';
import { UpdateUserDTO } from '../dto/update-user.dto';
import { User } from '../entities/user.entity';
import { UserRoleAuditLog } from '../entities/user-role-audit-log.entity';

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
  ) {
    super(userRepository, {
      logging: {
        logger: logger,
        serviceName: configService.get('IAM_PREFIX_NAME'),
        serviceVersion: configService.get('IAM_PREFIX_VERSION'),
      },
    });
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
