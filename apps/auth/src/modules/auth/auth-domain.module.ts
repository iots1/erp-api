import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule, ErpDatabases } from '@lib/common';

import { AuthController } from './controllers/auth.controller';
import { LoginHistoriesController } from './controllers/login-histories.controller';
import { SessionsController } from './controllers/sessions.controller';
import { BlockedUser } from './entities/blocked-user.entity';
import { Credential } from './entities/credential.entity';
import { LoginHistory } from './entities/login-history.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { SecurityLog } from './entities/security-log.entity';
import { AuthService } from './services/auth.service';
import { LoginHistoriesService } from './services/login-histories.service';
import { SessionsService } from './services/sessions.service';

/** JwtModule (with SECRET_KEY) is already provided globally by CommonModule. */
@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature(
      [Credential, RefreshToken, LoginHistory, BlockedUser, SecurityLog],
      ErpDatabases.AUTH,
    ),
  ],
  controllers: [AuthController, LoginHistoriesController, SessionsController],
  providers: [AuthService, LoginHistoriesService, SessionsService],
})
export class AuthDomainModule {}
