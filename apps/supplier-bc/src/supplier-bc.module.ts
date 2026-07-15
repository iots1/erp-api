import { Module } from '@nestjs/common';

import { CommonModule, ErpDatabases } from '@lib/common';
import { ConfigModule } from '@lib/config';
import { DatabaseModule } from '@lib/database';

import { SupplierModule } from './modules/supplier/supplier.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule.registerAsync(ErpDatabases.SUPPLIER),
    CommonModule,
    SupplierModule,
  ],
})
export class SupplierBcModule {}
