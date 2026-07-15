import { Module } from '@nestjs/common';

import { CommonModule, ErpDatabases } from '@lib/common';
import { ConfigModule } from '@lib/config';
import { DatabaseModule } from '@lib/database';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule.registerAsync(ErpDatabases.REPORT),
    CommonModule,
  ],
})
export class ReportBcModule {}
