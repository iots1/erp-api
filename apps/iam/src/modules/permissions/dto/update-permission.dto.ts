import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsOptional, IsString, Matches } from 'class-validator';

/**
 * `permission_name_th`/`permission_name_en` are editable on any row (cosmetic
 * only). `service`/`permission` are editable only when the target row is
 * `is_manual: true` — PermissionsService.updateManual() enforces that, since
 * these fields are what a synced row's `@RequirePermission()` decorator or
 * data-permission scan actually keys off. `plane`/`resource`/`action` are
 * never accepted here at all — `resource`/`action` re-derive from
 * `permission` when it changes, and `plane` cannot change post-creation.
 */
export class UpdatePermissionDTO {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9-]*$/, {
    message: 'service must be lowercase kebab-case, e.g. "iam", "inventory-bc"',
  })
  @ApiPropertyOptional({ example: 'iam' })
  service?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(page|component):[a-zA-Z0-9_]+$/, {
    message: 'permission must match "page:<slug>" or "component:<slug>"',
  })
  @ApiPropertyOptional({ example: 'page:view_reports' })
  permission?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'เข้าหน้ารายงาน' })
  permission_name_th?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'View reports page' })
  permission_name_en?: string;
}
