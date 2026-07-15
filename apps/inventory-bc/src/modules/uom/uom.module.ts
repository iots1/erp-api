import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule } from '@lib/common';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

import { UomsController } from './controllers/uoms.controller';
import { Uom } from './entities/uom.entity';
import { UomsService } from './services/uoms.service';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([Uom], ErpDatabases.INVENTORY),
  ],
  controllers: [UomsController],
  providers: [UomsService],
  exports: [UomsService],
})
export class UomModule {}
