import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule, ErpDatabases } from '@lib/common';

import { UsersController } from './controllers/users.controller';
import { User } from './entities/user.entity';
import { UserRole } from './entities/user-role.entity';
import { UsersService } from './services/users.service';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([User, UserRole], ErpDatabases.IAM),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
