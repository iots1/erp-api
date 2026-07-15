import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';

export const REQUIRE_PERMISSION_KEY = 'require_permission';
export const REQUIRE_PERMISSION_NAME_KEY = 'require_permission_name';

export interface IPermissionName {
  th: string;
  en: string;
}

/**
 * Usage: `@RequirePermission('patient:read')` or, to give `permissions:sync`
 * real display names instead of a humanized placeholder:
 * `@RequirePermission('patient:read', { th: 'ดูข้อมูลผู้ป่วย', en: 'View patient' })`
 */
export const RequirePermission = (
  permission: string,
  name?: IPermissionName,
): MethodDecorator =>
  applyDecorators(
    SetMetadata(REQUIRE_PERMISSION_KEY, permission),
    ...(name ? [SetMetadata(REQUIRE_PERMISSION_NAME_KEY, name)] : []),
    ApiExtension('x-required-permission', { permission, name }),
  );
