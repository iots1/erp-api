import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule } from '@lib/common';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

import { ItemGroupsController } from './controllers/item-groups.controller';
import { ItemGroup } from './entities/item-group.entity';
import { ItemGroupsService } from './services/item-groups.service';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([ItemGroup], ErpDatabases.INVENTORY),
  ],
  controllers: [ItemGroupsController],
  providers: [ItemGroupsService],
  exports: [ItemGroupsService],
})
export class ItemGroupModule {}
