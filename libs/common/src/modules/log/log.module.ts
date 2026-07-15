import { Module } from '@nestjs/common';

import { LogsService } from '@lib/common/modules/log/logs.service';

@Module({
  imports: [],
  providers: [LogsService],
  exports: [LogsService],
})
export class LogModule {}
