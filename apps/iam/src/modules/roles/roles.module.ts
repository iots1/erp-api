import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule, ErpDatabases } from '@lib/common';

import { AccessModule } from '../access/access.module';
import { RolesController } from './controllers/roles.controller';
import { Role } from './entities/role.entity';
import { RolePolicy } from './entities/role-policy.entity';
import { RolesService } from './services/roles.service';

@Module({
  imports: [
    CommonModule,
    AccessModule,
    TypeOrmModule.forFeature([Role, RolePolicy], ErpDatabases.IAM),
  ],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
