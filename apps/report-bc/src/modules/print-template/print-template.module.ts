import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule } from '@lib/common';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

import { GotenbergService } from '../print/services/gotenberg.service';
import { PrintTemplatesController } from './controllers/print-templates.controller';
import { PrintTemplate } from './entities/print-template.entity';
import { PrintTemplatesService } from './services/print-templates.service';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([PrintTemplate], ErpDatabases.REPORT),
  ],
  controllers: [PrintTemplatesController],
  // GotenbergService is stateless (wraps a fetch() client) — re-provided here
  // rather than importing PrintModule, keeping the two modules independent.
  providers: [PrintTemplatesService, GotenbergService],
  exports: [PrintTemplatesService],
})
export class PrintTemplateModule {}
