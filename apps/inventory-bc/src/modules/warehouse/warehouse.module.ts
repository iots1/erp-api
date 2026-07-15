import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule } from '@lib/common';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

import { WarehousesController } from './controllers/warehouses.controller';
import { Warehouse } from './entities/warehouse.entity';
import { WarehousesService } from './services/warehouses.service';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([Warehouse], ErpDatabases.INVENTORY),
  ],
  controllers: [WarehousesController],
  providers: [WarehousesService],
  exports: [WarehousesService],
})
export class WarehouseModule {}
