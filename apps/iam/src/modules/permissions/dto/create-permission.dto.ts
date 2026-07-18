import { ApiProperty } from '@nestjs/swagger';

import { IsNotEmpty, IsString, Matches } from 'class-validator';

/**
 * Manual permissions are always `plane: 'ui'` — `resource`/`action` are
 * derived server-side from `permission`, and `plane` is never accepted from
 * the client (the service hardcodes it). See PermissionsService.createManual().
 */
export class CreatePermissionDTO {
  @IsString()
  @Matches(/^[a-z][a-z0-9-]*$/, {
    message: 'service must be lowercase kebab-case, e.g. "iam", "inventory-bc"',
  })
  @ApiProperty({
    example: 'iam',
    description: 'BC ที่จะแสดงสิทธิ์นี้ เช่น iam, auth, inventory-bc',
  })
  service: string;

  @IsString()
  @Matches(/^(page|component):[a-zA-Z0-9_]+$/, {
    message: 'permission must match "page:<slug>" or "component:<slug>"',
  })
  @ApiProperty({
    example: 'page:view_reports',
    description: 'ต้องขึ้นต้นด้วย page: หรือ component: เท่านั้น (ui-plane)',
  })
  permission: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'เข้าหน้ารายงาน' })
  permission_name_th: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'View reports page' })
  permission_name_en: string;
}
