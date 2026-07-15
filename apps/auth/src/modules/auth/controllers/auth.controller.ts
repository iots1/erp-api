import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { FastifyRequest } from 'fastify';

import {
  CurrentUser,
  Public,
  RequirePermission,
  type IUserSession,
} from '@lib/common';

import { LoginResultDTO } from '../dto/login-result.dto';
import { LoginDTO } from '../dto/login.dto';
import { RefreshDTO } from '../dto/refresh.dto';
import { SetCredentialDTO } from '../dto/set-credential.dto';
import { AuthService, ILoginResult } from '../services/auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Login with username + password — issues JWT access/refresh tokens',
  })
  @ApiOkResponse({ type: LoginResultDTO })
  login(
    @Body() dto: LoginDTO,
    @Req() request: FastifyRequest,
  ): Promise<ILoginResult> {
    const ipAddress = request.ip ?? null;
    const userAgent = request.headers['user-agent'] ?? null;
    return this.authService.login(
      dto.username,
      dto.password,
      ipAddress,
      userAgent,
    );
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange a refresh token for a new access/refresh token pair',
  })
  @ApiOkResponse({ type: LoginResultDTO })
  refresh(@Body() dto: RefreshDTO): Promise<ILoginResult> {
    return this.authService.refresh(dto.refresh_token);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke the current session (and refresh token, if provided)',
  })
  async logout(
    @CurrentUser() currentUser: IUserSession,
    @Body() dto: Partial<RefreshDTO>,
  ): Promise<void> {
    await this.authService.logout(
      currentUser.jti,
      currentUser.id,
      dto.refresh_token,
    );
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get the current authenticated session' })
  me(@CurrentUser() currentUser: IUserSession): IUserSession {
    return currentUser;
  }

  @Post('credentials')
  @RequirePermission('user_account:set_password', {
    th: 'ตั้งรหัสผ่านผู้ใช้',
    en: 'Set user password',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Create/reset a user credential (admin flow, after iam user creation)',
  })
  async setCredential(
    @Body() dto: SetCredentialDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<void> {
    await this.authService.setCredential(dto, currentUser.id ?? undefined);
  }
}
