import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule, ErpDatabases } from '@lib/common';

import { AccessModule } from '../access/access.module';
import { RolesController } from './controllers/roles.controller';
import { RolePolicyAuditLog } from './entities/role-policy-audit-log.entity';
import { Role } from './entities/role.entity';
import { RolesService } from './services/roles.service';

@Module({
  imports: [
    CommonModule,
    AccessModule,
    TypeOrmModule.forFeature([Role, RolePolicyAuditLog], ErpDatabases.IAM),
  ],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
