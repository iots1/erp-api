import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import type { IUserSession } from '@lib/common/interfaces/auth.interface';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { BaseServiceOperations } from '@lib/common/utils/base-operations/base-service-operations.util';
import { ConfigService } from '@lib/config';

import { SessionSyncService } from '../../access/services/session-sync.service';
import { PolicyStatementInputDTO } from '../dto/set-statements.dto';
import { CreatePolicyDTO } from '../dto/create-policy.dto';
import { UpdatePolicyDTO } from '../dto/update-policy.dto';
import { Policy } from '../entities/policy.entity';
import { PolicyStatement } from '../entities/policy-statement.entity';
import { StatementAction } from '../entities/statement-action.entity';
import { StatementCondition } from '../entities/statement-condition.entity';
import { StatementTarget } from '../entities/statement-target.entity';

export interface IExpandedStatement {
  id: string;
  effect: string;
  plane: string;
  targets: Array<{ service: string; resource: string }>;
  permissions: string[];
  conditions: Array<{
    operator: string;
    condition_key: string;
    condition_value: string;
  }>;
}

@Injectable()
export class PoliciesService extends BaseServiceOperations<
  Policy,
  CreatePolicyDTO,
  UpdatePolicyDTO
> {
  constructor(
    protected readonly logger: LogsService,
    configService: ConfigService,
    @InjectRepository(Policy, ErpDatabases.IAM)
    policyRepository: Repository<Policy>,
    @InjectRepository(PolicyStatement, ErpDatabases.IAM)
    private readonly statementRepository: Repository<PolicyStatement>,
    @InjectRepository(StatementTarget, ErpDatabases.IAM)
    private readonly targetRepository: Repository<StatementTarget>,
    @InjectRepository(StatementAction, ErpDatabases.IAM)
    private readonly actionRepository: Repository<StatementAction>,
    @InjectRepository(StatementCondition, ErpDatabases.IAM)
    private readonly conditionRepository: Repository<StatementCondition>,
    private readonly sessionSync: SessionSyncService,
  ) {
    super(policyRepository, {
      logging: {
        logger: logger,
        serviceName: configService.get('IAM_PREFIX_NAME'),
        serviceVersion: configService.get('IAM_PREFIX_VERSION'),
      },
    });
  }

  /**
   * A policy still attached to at least one role (roles_policies) cannot be
   * deleted — that role's access would silently lose the statements it
   * relies on. The caller must detach the policy from every role first
   * (`PUT /roles/:id/policies` with it removed) before delete succeeds.
   */
  async delete(
    id: string | number,
    softDelete = true,
    currentUser?: IUserSession | string,
  ): Promise<void> {
    const attachedRoleCount = await this.typeOrmRepository.manager
      .createQueryBuilder()
      .select('1')
      .from('roles_policies', 'rp')
      .where('rp.policy_id = :policyId', { policyId: id })
      .getCount();

    if (attachedRoleCount > 0) {
      throw new ConflictException(
        'ไม่สามารถลบนโยบายนี้ได้ เนื่องจากมีบทบาท (Role) ผูกใช้งานอยู่ กรุณายกเลิกการผูกกับบทบาทก่อน',
      );
    }

    await super.delete(id, softDelete, currentUser);
  }

  /** Replaces every statement (+ targets/actions/conditions) belonging to a policy. */
  async setStatements(
    policyId: string,
    statements: PolicyStatementInputDTO[],
    userId?: string,
  ): Promise<void> {
    await this.executeDbOperation(() =>
      this.typeOrmRepository.manager.transaction(async (manager) => {
        const statementRepo = manager.getRepository(PolicyStatement);
        const targetRepo = manager.getRepository(StatementTarget);
        const actionRepo = manager.getRepository(StatementAction);
        const conditionRepo = manager.getRepository(StatementCondition);

        // Cascades to targets/actions/conditions via FK ON DELETE CASCADE.
        await statementRepo.delete({ policy_id: policyId });

        for (const input of statements) {
          const statement = await statementRepo.save(
            statementRepo.create({
              policy_id: policyId,
              effect: input.effect,
              plane: input.plane,
              created_by: userId,
              updated_by: userId,
            }),
          );

          const targets = input.service.flatMap((service) =>
            input.resource.map((resource) =>
              targetRepo.create({
                statement_id: statement.id,
                service,
                resource,
                created_by: userId,
                updated_by: userId,
              }),
            ),
          );
          await targetRepo.save(targets);

          const actions = input.permission_ids.map((permissionId) =>
            actionRepo.create({
              statement_id: statement.id,
              permission_id: permissionId,
              created_by: userId,
              updated_by: userId,
            }),
          );
          await actionRepo.save(actions);

          if (input.conditions.length > 0) {
            const conditions = input.conditions.map((condition) =>
              conditionRepo.create({
                statement_id: statement.id,
                operator: condition.operator,
                condition_key: condition.condition_key,
                condition_value: condition.condition_value,
                created_by: userId,
                updated_by: userId,
              }),
            );
            await conditionRepo.save(conditions);
          }
        }
      }),
    );
    await this.sessionSync.syncUsersByPolicy(policyId);
  }

  /** Expanded statement tree for a policy — used by the Policy Generator UI. */
  async getStatements(policyId: string): Promise<IExpandedStatement[]> {
    const statements = await this.statementRepository.find({
      where: { policy_id: policyId },
    });

    return Promise.all(
      statements.map(async (statement) => {
        const [targets, actions, conditions] = await Promise.all([
          this.targetRepository.find({ where: { statement_id: statement.id } }),
          this.actionRepository
            .createQueryBuilder('statement_action')
            .innerJoinAndSelect(
              'permissions',
              'permission',
              'permission.id = statement_action.permission_id',
            )
            .where('statement_action.statement_id = :statementId', {
              statementId: statement.id,
            })
            .select(['permission.permission AS permission'])
            .getRawMany<{ permission: string }>(),
          this.conditionRepository.find({
            where: { statement_id: statement.id },
          }),
        ]);

        return {
          id: statement.id,
          effect: statement.effect,
          plane: statement.plane,
          targets: targets.map((t) => ({
            service: t.service,
            resource: t.resource,
          })),
          permissions: actions.map((a) => a.permission),
          conditions: conditions.map((c) => ({
            operator: c.operator,
            condition_key: c.condition_key,
            condition_value: c.condition_value,
          })),
        };
      }),
    );
  }
}
