import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { BaseServiceOperations } from '@lib/common/utils/base-operations/base-service-operations.util';
import { ConfigService } from '@lib/config';

import { PermissionSyncLog } from '../entities/permission-sync-log.entity';

/**
 * Read-only — `permission_sync_logs` rows are written exclusively by
 * `PermissionsSyncService.runSync()` (or the `permissions:sync` CLI script);
 * this service only powers the history/audit list page.
 */
@Injectable()
export class PermissionSyncLogsService extends BaseServiceOperations<
  PermissionSyncLog,
  Partial<PermissionSyncLog>,
  Partial<PermissionSyncLog>
> {
  constructor(
    protected readonly logger: LogsService,
    configService: ConfigService,
    @InjectRepository(PermissionSyncLog, ErpDatabases.IAM)
    permissionSyncLogRepository: Repository<PermissionSyncLog>,
  ) {
    super(permissionSyncLogRepository, {
      logging: {
        logger: logger,
        serviceName: configService.get('IAM_PREFIX_NAME'),
        serviceVersion: configService.get('IAM_PREFIX_VERSION'),
      },
    });
  }
}
