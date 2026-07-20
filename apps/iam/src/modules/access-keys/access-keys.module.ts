import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule, ErpDatabases } from '@lib/common';

import { AccessModule } from '../access/access.module';
import { AccessKeysRpcController } from './controllers/access-keys-rpc.controller';
import { AccessKeysController } from './controllers/access-keys.controller';
import { AccessKey } from './entities/access-key.entity';
import { AccessKeysService } from './services/access-keys.service';

@Module({
  imports: [
    CommonModule,
    AccessModule,
    TypeOrmModule.forFeature([AccessKey], ErpDatabases.IAM),
  ],
  controllers: [AccessKeysController, AccessKeysRpcController],
  providers: [AccessKeysService],
  exports: [AccessKeysService],
})
export class AccessKeysModule {}
