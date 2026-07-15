import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule } from '@lib/common';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

import { ItemAttributeValuesController } from './controllers/item-attribute-values.controller';
import { ItemAttributesController } from './controllers/item-attributes.controller';
import { ItemAttributeValue } from './entities/item-attribute-value.entity';
import { ItemAttribute } from './entities/item-attribute.entity';
import { ItemAttributeValuesService } from './services/item-attribute-values.service';
import { ItemAttributesService } from './services/item-attributes.service';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature(
      [ItemAttribute, ItemAttributeValue],
      ErpDatabases.INVENTORY,
    ),
  ],
  controllers: [ItemAttributesController, ItemAttributeValuesController],
  providers: [ItemAttributesService, ItemAttributeValuesService],
  exports: [ItemAttributesService, ItemAttributeValuesService],
})
export class ItemAttributeModule {}
