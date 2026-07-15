import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { BaseServiceOperations } from '@lib/common/utils/base-operations/base-service-operations.util';
import { ConfigService } from '@lib/config';

import { Permission } from '../entities/permission.entity';

/** Read-only catalog — permissions are created by migration/admin tooling only. */
@Injectable()
export class PermissionsService extends BaseServiceOperations<
  Permission,
  Partial<Permission>,
  Partial<Permission>
> {
  constructor(
    protected readonly logger: LogsService,
    configService: ConfigService,
    @InjectRepository(Permission, ErpDatabases.IAM)
    permissionRepository: Repository<Permission>,
  ) {
    super(permissionRepository, {
      logging: {
        logger: logger,
        serviceName: configService.get('IAM_PREFIX_NAME'),
        serviceVersion: configService.get('IAM_PREFIX_VERSION'),
      },
    });
  }
}
