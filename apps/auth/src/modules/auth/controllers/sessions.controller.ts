import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import {
  CurrentUser,
  ParseUuidParamPipe,
  RequirePermission,
  type IUserSession,
} from '@lib/common';
import { ResourceType } from '@lib/common/decorators/resource-type.decorator';

import {
  GET_SESSIONS_SUMMARY,
  GET_USER_SESSIONS_SUMMARY,
  REVOKE_SESSION_SUMMARY,
  SESSION_JTI_PARAM_DESCRIPTION,
  SESSION_USER_ID_PARAM_DESCRIPTION,
} from '../constants/sessions.swagger';
import { SessionsService } from '../services/sessions.service';

@ResourceType('sessions')
@ApiTags('Sessions')
@Controller('auth/sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  @RequirePermission('session:read', {
    th: 'ดูผู้ใช้งานที่ออนไลน์',
    en: 'View active sessions',
  })
  @ApiOperation({ summary: GET_SESSIONS_SUMMARY })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findActive(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.sessionsService.findActive(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Get('users/:user_id')
  @RequirePermission('session:read', {
    th: 'ดูผู้ใช้งานที่ออนไลน์',
    en: 'View active sessions',
  })
  @ApiOperation({ summary: GET_USER_SESSIONS_SUMMARY })
  @ApiParam({ name: 'user_id', description: SESSION_USER_ID_PARAM_DESCRIPTION })
  findActiveForUser(@Param('user_id', ParseUuidParamPipe) userId: string) {
    return this.sessionsService.findActiveForUser(userId);
  }

  @Delete(':jti')
  @RequirePermission('session:revoke', {
    th: 'เพิกถอนการเข้าใช้งาน',
    en: 'Revoke active sessions',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: REVOKE_SESSION_SUMMARY })
  @ApiParam({ name: 'jti', description: SESSION_JTI_PARAM_DESCRIPTION })
  async revoke(
    @Param('jti', ParseUuidParamPipe) jti: string,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<void> {
    await this.sessionsService.revoke(jti, currentUser?.id ?? null);
  }
}
