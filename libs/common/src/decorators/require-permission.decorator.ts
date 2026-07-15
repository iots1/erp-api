import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';

export const REQUIRE_PERMISSION_KEY = 'require_permission';

/**
 * Usage: @RequirePermission('patient:read')
 */
export const RequirePermission = (permission: string): MethodDecorator =>
  applyDecorators(
    SetMetadata(REQUIRE_PERMISSION_KEY, permission),
    ApiExtension('x-required-permission', { permission }),
  );
