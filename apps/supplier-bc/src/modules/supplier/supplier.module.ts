import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule } from '@lib/common';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

import { SupplierEventsController } from './controllers/supplier-events.controller';
import { SuppliersController } from './controllers/suppliers.controller';
import { Supplier } from './entities/supplier.entity';
import { SuppliersService } from './services/suppliers.service';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([Supplier], ErpDatabases.SUPPLIER),
  ],
  controllers: [SuppliersController, SupplierEventsController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SupplierModule {}
