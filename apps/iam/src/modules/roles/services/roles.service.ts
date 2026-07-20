import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import type { IUserSession } from '@lib/common/interfaces/auth.interface';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { BaseServiceOperations } from '@lib/common/utils/base-operations/base-service-operations.util';
import { mapRelations } from '@lib/common/utils/map-relations.util';
import { ConfigService } from '@lib/config';

import { SessionSyncService } from '../../access/services/session-sync.service';
import { Policy } from '../../policies/entities/policy.entity';
import { CreateRoleDTO } from '../dto/create-role.dto';
import { UpdateRoleDTO } from '../dto/update-role.dto';
import { RolePolicyAuditLog } from '../entities/role-policy-audit-log.entity';
import { Role } from '../entities/role.entity';

@Injectable()
export class RolesService extends BaseServiceOperations<
  Role,
  CreateRoleDTO,
  UpdateRoleDTO
> {
  constructor(
    protected readonly logger: LogsService,
    configService: ConfigService,
    @InjectRepository(Role, ErpDatabases.IAM)
    roleRepository: Repository<Role>,
    @InjectRepository(RolePolicyAuditLog, ErpDatabases.IAM)
    private readonly auditLogRepository: Repository<RolePolicyAuditLog>,
    private readonly sessionSync: SessionSyncService,
  ) {
    super(roleRepository, {
      logging: {
        logger: logger,
        serviceName: configService.get('IAM_PREFIX_NAME'),
        serviceVersion: configService.get('IAM_PREFIX_VERSION'),
      },
    });
  }

  /**
   * A role still attached to at least one user (users_roles) cannot be
   * deleted — that user would silently lose the access the role grants. The
   * caller must unassign the role from every user first before delete
   * succeeds.
   */
  async delete(
    id: string | number,
    softDelete = true,
    currentUser?: IUserSession | string,
  ): Promise<void> {
    const attachedUserCount = await this.typeOrmRepository.manager
      .createQueryBuilder()
      .select('1')
      .from('users_roles', 'ur')
      .where('ur.role_id = :roleId', { roleId: id })
      .getCount();

    if (attachedUserCount > 0) {
      throw new ConflictException(
        'ไม่สามารถลบบทบาทนี้ได้ เนื่องจากมีผู้ใช้งานผูกใช้งานอยู่ กรุณายกเลิกการผูกกับผู้ใช้งานก่อน',
      );
    }

    await super.delete(id, softDelete, currentUser);
  }

  /** Replaces the full set of policies attached to a role (roles_policies join table). */
  async attachPolicies(
    roleId: string,
    policyIds: string[],
    currentUserId?: string,
  ): Promise<void> {
    await this.executeDbOperation(async () => {
      const role = await this.typeOrmRepository.findOne({
        where: { id: roleId },
        relations: ['policies'],
      });
      if (!role) {
        throw new NotFoundException(`Role ${roleId} not found`);
      }

      const previousIds = new Set(role.policies.map((policy) => policy.id));
      const nextIds = new Set(policyIds);
      const attached = policyIds.filter((id) => !previousIds.has(id));
      const detached = [...previousIds].filter((id) => !nextIds.has(id));

      role.policies = mapRelations<Policy>(policyIds);
      await this.typeOrmRepository.save(role);

      const auditEntries = [
        ...attached.map((policyId) =>
          this.auditLogRepository.create({
            role_id: roleId,
            policy_id: policyId,
            action: 'attached' as const,
            created_by: currentUserId,
          }),
        ),
        ...detached.map((policyId) =>
          this.auditLogRepository.create({
            role_id: roleId,
            policy_id: policyId,
            action: 'detached' as const,
            created_by: currentUserId,
          }),
        ),
      ];
      if (auditEntries.length > 0) {
        await this.auditLogRepository.save(auditEntries);
      }
    });
    await this.sessionSync.syncUsersByRole(roleId);
  }

  async findPolicyIds(roleId: string): Promise<string[]> {
    const role = await this.typeOrmRepository.findOne({
      where: { id: roleId },
      relations: ['policies'],
    });
    return role?.policies.map((policy) => policy.id) ?? [];
  }
}
