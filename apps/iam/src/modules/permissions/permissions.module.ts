import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule, ErpDatabases } from '@lib/common';

import { PermissionsController } from './controllers/permissions.controller';
import { Permission } from './entities/permission.entity';
import { PermissionSyncLog } from './entities/permission-sync-log.entity';
import { PermissionsService } from './services/permissions.service';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([Permission, PermissionSyncLog], ErpDatabases.IAM),
  ],
  controllers: [PermissionsController],
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
