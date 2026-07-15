import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule } from '@lib/common';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

import { SuppliersProxyService } from '../../integrations/supplier-bc/suppliers.proxy-service';
import { ItemAttributeValue } from '../item-attribute/entities/item-attribute-value.entity';
import { ItemVariantAttributesController } from './controllers/item-variant-attributes.controller';
import { ProductsController } from './controllers/products.controller';
import { ItemVariantAttribute } from './entities/item-variant-attribute.entity';
import { Product } from './entities/product.entity';
import { ItemVariantAttributesService } from './services/item-variant-attributes.service';
import { ProductsService } from './services/products.service';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature(
      [Product, ItemVariantAttribute, ItemAttributeValue],
      ErpDatabases.INVENTORY,
    ),
  ],
  controllers: [ProductsController, ItemVariantAttributesController],
  providers: [
    ProductsService,
    ItemVariantAttributesService,
    SuppliersProxyService,
  ],
  exports: [ProductsService],
})
export class ProductModule {}
