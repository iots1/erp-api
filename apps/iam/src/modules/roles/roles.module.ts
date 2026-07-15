import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule, ErpDatabases } from '@lib/common';

import { RolesController } from './controllers/roles.controller';
import { Role } from './entities/role.entity';
import { RolePolicy } from './entities/role-policy.entity';
import { RolesService } from './services/roles.service';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([Role, RolePolicy], ErpDatabases.IAM),
  ],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
