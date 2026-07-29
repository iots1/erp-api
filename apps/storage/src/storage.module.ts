import { Module } from '@nestjs/common';

import { CommonModule } from '@lib/common';
import { ConfigModule } from '@lib/config';

import { StorageEventsController } from './storage-events.controller';
import { StorageService } from './storage.service';

@Module({
  imports: [ConfigModule, CommonModule],
  controllers: [StorageEventsController],
  providers: [StorageService],
})
export class StorageModule {}
