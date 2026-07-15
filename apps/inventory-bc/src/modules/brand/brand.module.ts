import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule } from '@lib/common';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

import { BrandsController } from './controllers/brands.controller';
import { Brand } from './entities/brand.entity';
import { BrandsService } from './services/brands.service';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([Brand], ErpDatabases.INVENTORY),
  ],
  controllers: [BrandsController],
  providers: [BrandsService],
  exports: [BrandsService],
})
export class BrandModule {}
