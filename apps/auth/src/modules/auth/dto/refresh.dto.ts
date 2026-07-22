import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsOptional, IsString } from 'class-validator';

export class RefreshDTO {
  // Optional: browser clients rely on the httpOnly `refresh_token` cookie
  // instead (see auth-cookie.util.ts) — only non-cookie API clients need to
  // supply this explicitly.
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description:
      'Refresh token issued at login. Omit if relying on the httpOnly refresh_token cookie.',
  })
  refresh_token?: string;
}
