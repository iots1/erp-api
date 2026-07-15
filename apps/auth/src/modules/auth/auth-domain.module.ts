import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule, ErpDatabases } from '@lib/common';

import { AuthController } from './controllers/auth.controller';
import { BlockedUser } from './entities/blocked-user.entity';
import { Credential } from './entities/credential.entity';
import { LoginHistory } from './entities/login-history.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { SecurityLog } from './entities/security-log.entity';
import { AuthService } from './services/auth.service';

/** JwtModule (with SECRET_KEY) is already provided globally by CommonModule. */
@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature(
      [Credential, RefreshToken, LoginHistory, BlockedUser, SecurityLog],
      ErpDatabases.AUTH,
    ),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthDomainModule {}
