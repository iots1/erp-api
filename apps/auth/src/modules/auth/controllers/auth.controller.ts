import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { FastifyReply, FastifyRequest } from 'fastify';

import {
  clearAuthCookies,
  CurrentUser,
  Public,
  RequirePermission,
  setAuthCookies,
  SkipCsrfCheck,
  SkipPermissionCheck,
  type IUserSession,
} from '@lib/common';
import { ConfigService } from '@lib/config';

import {
  LOGIN_SUMMARY,
  LOGOUT_SUMMARY,
  ME_SUMMARY,
  REFRESH_SUMMARY,
  SET_CREDENTIAL_SUMMARY,
} from '../constants/auth.swagger';
import { LoginResultDTO } from '../dto/login-result.dto';
import { LoginDTO } from '../dto/login.dto';
import { RefreshDTO } from '../dto/refresh.dto';
import { SetCredentialDTO } from '../dto/set-credential.dto';
import { AuthService, ILoginResult } from '../services/auth.service';
import { parseDurationToSeconds } from '../utils/duration.util';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @SkipCsrfCheck()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: LOGIN_SUMMARY })
  @ApiOkResponse({ type: LoginResultDTO })
  async login(
    @Body() dto: LoginDTO,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<ILoginResult> {
    const ipAddress = request.ip ?? null;
    const userAgent = request.headers['user-agent'] ?? null;
    const result = await this.authService.login(
      dto.username,
      dto.password,
      ipAddress,
      userAgent,
    );
    this.setCookies(reply, result);
    return result;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: REFRESH_SUMMARY })
  @ApiOkResponse({ type: LoginResultDTO })
  async refresh(
    @Body() dto: RefreshDTO,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<ILoginResult> {
    const refreshTokenRaw = dto.refresh_token ?? request.cookies?.refresh_token;
    if (!refreshTokenRaw) {
      throw new BadRequestException('Refresh token is required.');
    }
    const result = await this.authService.refresh(refreshTokenRaw);
    this.setCookies(reply, result);
    return result;
  }

  @Post('logout')
  @SkipPermissionCheck()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: LOGOUT_SUMMARY })
  async logout(
    @CurrentUser() currentUser: IUserSession,
    @Body() dto: Partial<RefreshDTO>,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const refreshTokenRaw = dto.refresh_token ?? request.cookies?.refresh_token;
    await this.authService.logout(
      currentUser.jti,
      currentUser.id,
      refreshTokenRaw,
    );
    clearAuthCookies(reply, this.configService, this.refreshCookiePath());
  }

  @Get('me')
  @SkipPermissionCheck()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: ME_SUMMARY })
  me(@CurrentUser() currentUser: IUserSession): IUserSession {
    return currentUser;
  }

  @Post('credentials')
  @RequirePermission('user_account:set_password', {
    th: 'ตั้งรหัสผ่านผู้ใช้',
    en: 'Set user password',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: SET_CREDENTIAL_SUMMARY })
  async setCredential(
    @Body() dto: SetCredentialDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<void> {
    await this.authService.setCredential(dto, currentUser.id ?? undefined);
  }

  private setCookies(reply: FastifyReply, result: ILoginResult): void {
    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    setAuthCookies(reply, this.configService, {
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      csrf_token: result.csrf_token,
      accessTtlSeconds: result.expires_in,
      refreshTtlSeconds: parseDurationToSeconds(refreshExpiresIn),
      refreshCookiePath: this.refreshCookiePath(),
    });
  }

  /** Scopes the refresh_token cookie to this BC's own route prefix (e.g.
   * `/auth/v1`) — only auth-bc's own refresh/logout handlers need it. */
  private refreshCookiePath(): string {
    const prefixName = this.configService.get<string>('AUTH_PREFIX_NAME');
    const prefixVersion = this.configService.get<string>('AUTH_PREFIX_VERSION');
    return `/${prefixName}/${prefixVersion}`;
  }
}
