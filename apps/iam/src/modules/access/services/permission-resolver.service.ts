import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { In, Repository } from 'typeorm';

import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

import { Policy } from '../../policies/entities/policy.entity';
import { PolicyStatement } from '../../policies/entities/policy-statement.entity';
import { StatementAction } from '../../policies/entities/statement-action.entity';
import { StatementCondition } from '../../policies/entities/statement-condition.entity';
import { StatementTarget } from '../../policies/entities/statement-target.entity';
import { Permission } from '../../permissions/entities/permission.entity';
import { Role } from '../../roles/entities/role.entity';
import { RolePolicy } from '../../roles/entities/role-policy.entity';
import { UserRole } from '../../users/entities/user-role.entity';

interface IResolvedStatement {
  effect: 'allow' | 'deny';
  permissions: string[];
  hasConditions: boolean;
  targets: Array<{ service: string; resource: string }>;
  conditions: StatementCondition[];
}

export interface IPermissionResolution {
  roles: string[];
  permissions: string[];
  conditional_permissions: string[];
}

@Injectable()
export class PermissionResolverService {
  constructor(
    @InjectRepository(UserRole, ErpDatabases.IAM)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(Role, ErpDatabases.IAM)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(RolePolicy, ErpDatabases.IAM)
    private readonly rolePolicyRepository: Repository<RolePolicy>,
    @InjectRepository(Policy, ErpDatabases.IAM)
    private readonly policyRepository: Repository<Policy>,
    @InjectRepository(PolicyStatement, ErpDatabases.IAM)
    private readonly statementRepository: Repository<PolicyStatement>,
    @InjectRepository(StatementTarget, ErpDatabases.IAM)
    private readonly targetRepository: Repository<StatementTarget>,
    @InjectRepository(StatementAction, ErpDatabases.IAM)
    private readonly actionRepository: Repository<StatementAction>,
    @InjectRepository(StatementCondition, ErpDatabases.IAM)
    private readonly conditionRepository: Repository<StatementCondition>,
    @InjectRepository(Permission, ErpDatabases.IAM)
    private readonly permissionRepository: Repository<Permission>,
  ) {}

  /** Walks user_roles → role_policies → policies → statements and resolves the net permission set. */
  async resolveForUser(userId: string): Promise<IPermissionResolution> {
    const userRoles = await this.userRoleRepository.find({
      where: { user_id: userId },
    });
    const roleIds = [...new Set(userRoles.map((ur) => ur.role_id))];

    if (roleIds.length === 0) {
      return { roles: [], permissions: [], conditional_permissions: [] };
    }

    const roles = await this.roleRepository.find({
      where: { id: In(roleIds) },
    });

    const rolePolicies = await this.rolePolicyRepository.find({
      where: { role_id: In(roleIds) },
    });
    const policyIds = [...new Set(rolePolicies.map((rp) => rp.policy_id))];

    if (policyIds.length === 0) {
      return {
        roles: roles.map((r) => r.code),
        permissions: [],
        conditional_permissions: [],
      };
    }

    const activePolicies = await this.policyRepository.find({
      where: { id: In(policyIds), is_active: true },
    });
    const activePolicyIds = activePolicies.map((p) => p.id);

    const statements = await this.resolveStatements(activePolicyIds);

    const allow = new Set<string>();
    const deny = new Set<string>();
    const conditional = new Set<string>();

    for (const statement of statements) {
      for (const permission of statement.permissions) {
        if (statement.hasConditions) {
          conditional.add(permission);
        } else if (statement.effect === 'allow') {
          allow.add(permission);
        } else {
          deny.add(permission);
        }
      }
    }

    // Deny-override; anything requiring per-request condition evaluation is excluded
    // from the unconditional set even if also allowed elsewhere (evaluated at request time instead).
    const permissions = [...allow].filter(
      (p) => !deny.has(p) && !conditional.has(p),
    );

    return {
      roles: roles.map((r) => r.code),
      permissions,
      conditional_permissions: [...conditional],
    };
  }

  /**
   * Evaluates ABAC conditions for a single resource:action at request time.
   * Deny-override: any matching deny statement whose conditions all hold → false.
   * Otherwise: true if any matching allow statement's conditions all hold.
   */
  async evaluate(
    userId: string,
    service: string,
    permission: string,
    context: Record<string, string>,
  ): Promise<boolean> {
    const userRoles = await this.userRoleRepository.find({
      where: { user_id: userId },
    });
    const roleIds = [...new Set(userRoles.map((ur) => ur.role_id))];
    if (roleIds.length === 0) return false;

    const rolePolicies = await this.rolePolicyRepository.find({
      where: { role_id: In(roleIds) },
    });
    const policyIds = [...new Set(rolePolicies.map((rp) => rp.policy_id))];
    if (policyIds.length === 0) return false;

    const activePolicies = await this.policyRepository.find({
      where: { id: In(policyIds), is_active: true },
    });

    const statements = await this.resolveStatements(
      activePolicies.map((p) => p.id),
      { permission, service },
    );

    // `service` is accepted for future per-service scoping/audit but not yet enforced here —
    // statement_targets already records it for the Policy Generator UI to display.
    const matches = (list: IResolvedStatement[]): IResolvedStatement[] =>
      list.filter((s) => s.permissions.includes(permission));

    const denyStatements = matches(
      statements.filter((s) => s.effect === 'deny'),
    );
    if (
      denyStatements.some((s) =>
        this.conditionsHold(s.conditions, userId, context),
      )
    ) {
      return false;
    }

    const allowStatements = matches(
      statements.filter((s) => s.effect === 'allow'),
    );
    return allowStatements.some((s) =>
      this.conditionsHold(s.conditions, userId, context),
    );
  }

  private async resolveStatements(
    policyIds: string[],
    filter?: { permission: string; service: string },
  ): Promise<IResolvedStatement[]> {
    if (policyIds.length === 0) return [];

    const statements = await this.statementRepository.find({
      where: { policy_id: In(policyIds) },
    });
    if (statements.length === 0) return [];
    const statementIds = statements.map((s) => s.id);

    const [targets, actions, conditions] = await Promise.all([
      this.targetRepository.find({ where: { statement_id: In(statementIds) } }),
      this.actionRepository.find({ where: { statement_id: In(statementIds) } }),
      this.conditionRepository.find({
        where: { statement_id: In(statementIds) },
      }),
    ]);

    const permissionIds = [...new Set(actions.map((a) => a.permission_id))];
    const permissions =
      permissionIds.length > 0
        ? await this.permissionRepository.find({
            where: { id: In(permissionIds) },
          })
        : [];
    const permissionById = new Map(
      permissions.map((p) => [p.id, p.permission]),
    );

    return statements
      .map((statement) => {
        const statementActions = actions.filter(
          (a) => a.statement_id === statement.id,
        );
        const permissionStrings = statementActions
          .map((a) => permissionById.get(a.permission_id))
          .filter((p): p is string => p !== undefined);

        return {
          effect: statement.effect,
          permissions: permissionStrings,
          hasConditions: conditions.some(
            (c) => c.statement_id === statement.id,
          ),
          targets: targets
            .filter((t) => t.statement_id === statement.id)
            .map((t) => ({ service: t.service, resource: t.resource })),
          conditions: conditions.filter((c) => c.statement_id === statement.id),
        };
      })
      .filter((s) =>
        filter === undefined ? true : s.permissions.includes(filter.permission),
      );
  }

  private conditionsHold(
    conditions: StatementCondition[],
    userId: string,
    context: Record<string, string>,
  ): boolean {
    if (conditions.length === 0) return true;
    return conditions.every((condition) =>
      this.evaluateCondition(condition, userId, context),
    );
  }

  private evaluateCondition(
    condition: StatementCondition,
    userId: string,
    context: Record<string, string>,
  ): boolean {
    const expected = condition.condition_value.replace('${user.id}', userId);
    const actual = context[condition.condition_key];
    if (actual === undefined) return false;

    switch (condition.operator) {
      case 'StringEquals':
        return actual === expected;
      case 'StringLike':
        return new RegExp(`^${expected.replace(/\*/g, '.*')}$`).test(actual);
      case 'NumericEquals':
        return Number(actual) === Number(expected);
      case 'NumericGreaterThan':
        return Number(actual) > Number(expected);
      case 'NumericLessThan':
        return Number(actual) < Number(expected);
      case 'DateGreaterThan':
        return Date.parse(actual) > Date.parse(expected) || actual > expected;
      case 'DateLessThan':
        return Date.parse(actual) < Date.parse(expected) || actual < expected;
      case 'IpAddress':
        return actual === expected;
      default:
        return false;
    }
  }
}
