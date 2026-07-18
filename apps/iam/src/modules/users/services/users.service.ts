import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { BaseServiceOperations } from '@lib/common/utils/base-operations/base-service-operations.util';
import { ConfigService } from '@lib/config';

import { SessionSyncService } from '../../access/services/session-sync.service';
import { CreateUserDTO } from '../dto/create-user.dto';
import { UpdateUserDTO } from '../dto/update-user.dto';
import { User } from '../entities/user.entity';
import { UserRole } from '../entities/user-role.entity';

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
    @InjectRepository(UserRole, ErpDatabases.IAM)
    private readonly userRoleRepository: Repository<UserRole>,
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

  /** Replaces the full set of roles assigned to a user. */
  async assignRoles(
    userId: string,
    roleIds: string[],
    currentUserId?: string,
  ): Promise<void> {
    await this.executeDbOperation(async () => {
      await this.userRoleRepository.delete({ user_id: userId });
      if (roleIds.length === 0) return;

      const entities = roleIds.map((roleId) =>
        this.userRoleRepository.create({
          user_id: userId,
          role_id: roleId,
          created_by: currentUserId,
          updated_by: currentUserId,
        }),
      );
      await this.userRoleRepository.save(entities);
    });
    await this.sessionSync.syncUser(userId);
  }

  async findRoleIds(userId: string): Promise<string[]> {
    const rows = await this.userRoleRepository.find({
      where: { user_id: userId },
    });
    return rows.map((row) => row.role_id);
  }
}
