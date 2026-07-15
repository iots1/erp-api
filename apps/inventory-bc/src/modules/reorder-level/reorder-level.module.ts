import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule } from '@lib/common';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

import { ReorderLevelsController } from './controllers/reorder-levels.controller';
import { ReorderLevel } from './entities/reorder-level.entity';
import { ReorderLevelsService } from './services/reorder-levels.service';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([ReorderLevel], ErpDatabases.INVENTORY),
  ],
  controllers: [ReorderLevelsController],
  providers: [ReorderLevelsService],
  exports: [ReorderLevelsService],
})
export class ReorderLevelModule {}
