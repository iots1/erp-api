import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

import { Policy } from '../policies/entities/policy.entity';
import { PolicyStatement } from '../policies/entities/policy-statement.entity';
import { StatementAction } from '../policies/entities/statement-action.entity';
import { StatementCondition } from '../policies/entities/statement-condition.entity';
import { StatementTarget } from '../policies/entities/statement-target.entity';
import { Permission } from '../permissions/entities/permission.entity';
import { Role } from '../roles/entities/role.entity';
import { RolePolicy } from '../roles/entities/role-policy.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { AccessEventsController } from './controllers/access-events.controller';
import { PermissionResolverService } from './services/permission-resolver.service';
import { SessionSyncService } from './services/session-sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [
        User,
        UserRole,
        Role,
        RolePolicy,
        Policy,
        PolicyStatement,
        StatementTarget,
        StatementAction,
        StatementCondition,
        Permission,
      ],
      ErpDatabases.IAM,
    ),
  ],
  controllers: [AccessEventsController],
  providers: [PermissionResolverService, SessionSyncService],
  exports: [SessionSyncService],
})
export class AccessModule {}
