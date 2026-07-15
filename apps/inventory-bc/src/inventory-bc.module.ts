import { Module } from '@nestjs/common';

import { CommonModule, ErpDatabases } from '@lib/common';
import { ConfigModule } from '@lib/config';
import { DatabaseModule } from '@lib/database';

import { BrandModule } from './modules/brand/brand.module';
import { ItemAttributeModule } from './modules/item-attribute/item-attribute.module';
import { ItemGroupModule } from './modules/item-group/item-group.module';
import { ProductModule } from './modules/product/product.module';
import { ReorderLevelModule } from './modules/reorder-level/reorder-level.module';
import { UomConversionModule } from './modules/uom-conversion/uom-conversion.module';
import { UomModule } from './modules/uom/uom.module';
import { WarehouseModule } from './modules/warehouse/warehouse.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule.registerAsync(ErpDatabases.INVENTORY),
    CommonModule,
    UomModule,
    BrandModule,
    ItemGroupModule,
    WarehouseModule,
    ItemAttributeModule,
    ProductModule,
    UomConversionModule,
    ReorderLevelModule,
  ],
})
export class InventoryBcModule {}
