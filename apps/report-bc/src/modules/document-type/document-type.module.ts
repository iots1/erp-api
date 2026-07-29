import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule } from '@lib/common';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

import { DocumentTypesController } from './controllers/document-types.controller';
import { DocumentRunningNumber } from './entities/document-running-number.entity';
import { DocumentType } from './entities/document-type.entity';
import { DocumentTypesService } from './services/document-types.service';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature(
      [DocumentType, DocumentRunningNumber],
      ErpDatabases.REPORT,
    ),
  ],
  controllers: [DocumentTypesController],
  providers: [DocumentTypesService],
  exports: [DocumentTypesService],
})
export class DocumentTypeModule {}
