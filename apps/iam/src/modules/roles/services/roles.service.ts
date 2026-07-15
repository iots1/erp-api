import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { BaseServiceOperations } from '@lib/common/utils/base-operations/base-service-operations.util';
import { ConfigService } from '@lib/config';

import { CreateRoleDTO } from '../dto/create-role.dto';
import { UpdateRoleDTO } from '../dto/update-role.dto';
import { Role } from '../entities/role.entity';
import { RolePolicy } from '../entities/role-policy.entity';

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
    @InjectRepository(RolePolicy, ErpDatabases.IAM)
    private readonly rolePolicyRepository: Repository<RolePolicy>,
  ) {
    super(roleRepository, {
      logging: {
        logger: logger,
        serviceName: configService.get('IAM_PREFIX_NAME'),
        serviceVersion: configService.get('IAM_PREFIX_VERSION'),
      },
    });
  }

  /** Replaces the full set of policies attached to a role. */
  async attachPolicies(
    roleId: string,
    policyIds: string[],
    currentUserId?: string,
  ): Promise<void> {
    await this.executeDbOperation(async () => {
      await this.rolePolicyRepository.delete({ role_id: roleId });
      if (policyIds.length === 0) return;

      const entities = policyIds.map((policyId) =>
        this.rolePolicyRepository.create({
          role_id: roleId,
          policy_id: policyId,
          created_by: currentUserId,
          updated_by: currentUserId,
        }),
      );
      await this.rolePolicyRepository.save(entities);
    });
  }

  async findPolicyIds(roleId: string): Promise<string[]> {
    const rows = await this.rolePolicyRepository.find({
      where: { role_id: roleId },
    });
    return rows.map((row) => row.policy_id);
  }
}
