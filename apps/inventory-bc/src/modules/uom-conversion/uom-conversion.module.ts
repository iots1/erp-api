import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule } from '@lib/common';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

import { Product } from '../product/entities/product.entity';
import { Uom } from '../uom/entities/uom.entity';
import { UomConversionFactorsController } from './controllers/uom-conversion-factors.controller';
import { UomConversionFactor } from './entities/uom-conversion-factor.entity';
import { UomConversionFactorsService } from './services/uom-conversion-factors.service';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature(
      [UomConversionFactor, Product, Uom],
      ErpDatabases.INVENTORY,
    ),
  ],
  controllers: [UomConversionFactorsController],
  providers: [UomConversionFactorsService],
  exports: [UomConversionFactorsService],
})
export class UomConversionModule {}
