import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import { IUserSession } from '@lib/common/interfaces/auth.interface';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { BaseServiceOperations } from '@lib/common/utils/base-operations/base-service-operations.util';
import { ConfigService } from '@lib/config';

import { CreatePermissionDTO } from '../dto/create-permission.dto';
import { UpdatePermissionDTO } from '../dto/update-permission.dto';
import { Permission } from '../entities/permission.entity';

/**
 * List/read is unrestricted (whole catalog, both planes — powers the Policy
 * Generator). Write access is deliberately asymmetric:
 *
 * - Create is manual-only and forced to `plane: 'ui'` — there is no
 *   `plane: 'api'` create path, since an api-plane row with no matching
 *   `@RequirePermission()` decorator would be a phantom permission: grantable
 *   in the Policy Generator but never actually enforced by any Guard.
 * - Update always allows the display name; changing `service`/`permission`
 *   is blocked unless the row is `is_manual` (a synced row's identity must
 *   match its source — code or the ui-permissions manifest — or the next
 *   `permissions:sync` just fights the edit).
 * - Delete is blocked entirely unless the row is `is_manual`. A synced row
 *   still declared in code must be removed at the source (delete the
 *   decorator / data-permission usage) and re-synced, not deleted here.
 */
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

  async createManual(
    dto: CreatePermissionDTO,
    currentUser?: IUserSession | string,
  ): Promise<Permission> {
    const [resource, action] = dto.permission.split(':');
    return this.create(
      {
        service: dto.service,
        permission: dto.permission,
        resource,
        action,
        plane: 'ui',
        permission_name_th: dto.permission_name_th,
        permission_name_en: dto.permission_name_en,
        is_manual: true,
      },
      currentUser,
    );
  }

  async updateManual(
    id: string,
    dto: UpdatePermissionDTO,
    currentUser?: IUserSession | string,
  ): Promise<Permission> {
    const existing = await this.findById(id);

    const changesIdentity = dto.service !== undefined || dto.permission !== undefined;
    if (changesIdentity && !existing.is_manual) {
      throw new ForbiddenException(
        'This permission is synced from code — edit the @RequirePermission()/data-permission source and run permissions:sync instead of changing service/permission here.',
      );
    }

    const patch: Partial<Permission> = {
      permission_name_th: dto.permission_name_th,
      permission_name_en: dto.permission_name_en,
    };
    if (dto.service !== undefined) patch.service = dto.service;
    if (dto.permission !== undefined) {
      patch.permission = dto.permission;
      [patch.resource, patch.action] = dto.permission.split(':');
    }

    return this.update(id, patch, currentUser);
  }

  async removeManual(
    id: string,
    currentUser?: IUserSession | string,
  ): Promise<void> {
    const existing = await this.findById(id);
    if (!existing.is_manual) {
      throw new BadRequestException(
        'This permission is synced from code and cannot be deleted here — remove the @RequirePermission()/data-permission usage from source and run permissions:sync.',
      );
    }
    await this.delete(id, true, currentUser);
  }
}
