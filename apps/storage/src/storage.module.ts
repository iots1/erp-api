import { Module } from '@nestjs/common';

import { CommonModule } from '@lib/common';
import { ConfigModule } from '@lib/config';

import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';

@Module({
  imports: [ConfigModule, CommonModule],
  controllers: [StorageController],
  providers: [StorageService],
})
export class StorageModule {}
