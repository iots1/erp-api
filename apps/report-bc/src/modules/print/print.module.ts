import { Module } from '@nestjs/common';

import { PrintController } from './print.controller';
import { GotenbergService } from './services/gotenberg.service';
import { InvoicePrintService } from './services/invoice-print.service';

/**
 * Owns document templates + PDF generation for report-bc. `CommonModule`
 * (imported globally by `ReportBcModule`) already registers a `ClientProxy`
 * for every `AppMicroservice` entry, including Storage — no extra
 * `ClientsModule` wiring needed here.
 */
@Module({
  controllers: [PrintController],
  providers: [GotenbergService, InvoicePrintService],
})
export class PrintModule {}
