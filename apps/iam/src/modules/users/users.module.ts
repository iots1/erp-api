import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule, ErpDatabases } from '@lib/common';

import { AccessModule } from '../access/access.module';
import { UsersController } from './controllers/users.controller';
import { User } from './entities/user.entity';
import { UserRoleAuditLog } from './entities/user-role-audit-log.entity';
import { UsersService } from './services/users.service';

@Module({
  imports: [
    CommonModule,
    AccessModule,
    TypeOrmModule.forFeature([User, UserRoleAuditLog], ErpDatabases.IAM),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
