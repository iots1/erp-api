import { Module } from '@nestjs/common';

import { CommonModule, ErpDatabases } from '@lib/common';
import { ConfigModule } from '@lib/config';
import { DatabaseModule } from '@lib/database';

import { DocumentTypeModule } from './modules/document-type/document-type.module';
import { PrintModule } from './modules/print/print.module';
import { PrintTemplateModule } from './modules/print-template/print-template.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule.registerAsync(ErpDatabases.REPORT),
    CommonModule,
    PrintModule,
    PrintTemplateModule,
    DocumentTypeModule,
  ],
})
export class ReportBcModule {}
