import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule } from '@lib/common';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

import { PrintTemplatesController } from './controllers/print-templates.controller';
import { PrintTemplate } from './entities/print-template.entity';
import { PrintTemplatesService } from './services/print-templates.service';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([PrintTemplate], ErpDatabases.REPORT),
  ],
  controllers: [PrintTemplatesController],
  providers: [PrintTemplatesService],
  exports: [PrintTemplatesService],
})
export class PrintTemplateModule {}
