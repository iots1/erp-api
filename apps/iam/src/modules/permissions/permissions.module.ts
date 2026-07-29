import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule, ErpDatabases } from '@lib/common';

import { PermissionSyncsController } from './controllers/permission-syncs.controller';
import { PermissionsController } from './controllers/permissions.controller';
import { Permission } from './entities/permission.entity';
import { PermissionSyncLog } from './entities/permission-sync-log.entity';
import { PermissionSyncLogsService } from './services/permission-sync-logs.service';
import { PermissionsSyncService } from './services/permissions-sync.service';
import { PermissionsService } from './services/permissions.service';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([Permission, PermissionSyncLog], ErpDatabases.IAM),
  ],
  controllers: [PermissionsController, PermissionSyncsController],
  providers: [PermissionsService, PermissionsSyncService, PermissionSyncLogsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
