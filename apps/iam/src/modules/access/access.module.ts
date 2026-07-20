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
import { User } from '../users/entities/user.entity';
import { AccessEventsController } from './controllers/access-events.controller';
import { PermissionResolverService } from './services/permission-resolver.service';
import { SessionSyncService } from './services/session-sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [
        User,
        Role,
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
