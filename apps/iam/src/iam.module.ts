import { Module } from '@nestjs/common';

import { CommonModule, ErpDatabases } from '@lib/common';
import { ConfigModule } from '@lib/config';
import { DatabaseModule } from '@lib/database';

import { AccessModule } from './modules/access/access.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { PoliciesModule } from './modules/policies/policies.module';
import { RolesModule } from './modules/roles/roles.module';
import { UsersModule } from './modules/users/users.module';
import { ViewsModule } from './modules/views/views.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule.registerAsync(ErpDatabases.IAM),
    CommonModule,
    UsersModule,
    RolesModule,
    PoliciesModule,
    PermissionsModule,
    AccessModule,
    ViewsModule,
  ],
})
export class IamModule {}
