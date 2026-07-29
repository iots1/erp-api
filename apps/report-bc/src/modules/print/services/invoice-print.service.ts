import path from 'path';
import { randomUUID } from 'crypto';

import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import * as ejs from 'ejs';

import { AppMicroservice } from '@lib/common/enum/app-microservice.enum';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { MicroserviceClientService } from '@lib/common/services/microservice-client.service';
import { ConfigService } from '@lib/config';

import { CreateInvoicePrintDTO } from '../dto/create-invoice-print.dto';
import { InvoicePrintResultDTO } from '../dto/invoice-print-result.dto';
import {
  IPrintFilePayload,
  IStorageUploadResult,
} from '../interfaces/storage-upload.interface';
import { GotenbergService } from './gotenberg.service';

const VAT_RATE = 7;
// `nest start` (ts-node) and `node dist/apps/report-bc/main.js` (webpack, no
// asset copy step) are both launched via an npm script from the repo root, so
// process.cwd() is a stable anchor in both dev and prod — unlike __dirname,
// which points into dist/ in prod where this .ejs was never bundled. Same
// reasoning as apps/iam/src/main.ts's `views.dir`.
const TEMPLATE_PATH = path.join(
  process.cwd(),
  'apps/report-bc/src/modules/print/templates/invoice.ejs',
);
const STORAGE_KEY_PREFIX = 'reports/invoices';

/** Formats a number as Thai baht, e.g. 1234.5 → "1,234.50". */
function formatAmount(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface MockInvoiceDefaults {
  invoice_no: string;
  invoice_date: string;
  due_date: string;
  customer_name_th: string;
  customer_name_en: string;
  customer_address_th: string;
  customer_address_en: string;
  note_th: string;
  note_en: string;
  items: Required<
    Pick<
      NonNullable<CreateInvoicePrintDTO['items']>[number],
      'description_th' | 'description_en' | 'quantity' | 'unit_price'
    >
  >[];
}

function mockInvoiceDefaults(): MockInvoiceDefaults {
  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + 14);

  return {
    invoice_no: `INV-${today.getFullYear()}-${String(Date.now()).slice(-6)}`,
    invoice_date: today.toISOString().slice(0, 10),
    due_date: dueDate.toISOString().slice(0, 10),
    customer_name_th: 'บริษัท ตัวอย่าง จำกัด',
    customer_name_en: 'Example Co., Ltd.',
    customer_address_th:
      '123 ถนนสุขุมวิท แขวงคลองตัน เขตคลองเตย กรุงเทพฯ 10110',
    customer_address_en:
      '123 Sukhumvit Rd., Klongtan, Klongtoey, Bangkok 10110',
    note_th: 'ขอบคุณที่ใช้บริการ',
    note_en: 'Thank you for your business',
    items: [
      {
        description_th: 'ค่าบริการที่ปรึกษาระบบ ERP',
        description_en: 'ERP consulting service',
        quantity: 1,
        unit_price: 15000,
      },
      {
        description_th: 'ค่าบำรุงรักษาระบบรายเดือน',
        description_en: 'Monthly system maintenance',
        quantity: 2,
        unit_price: 3500,
      },
    ],
  };
}

/**
 * Owns the print pipeline for invoices: render the EJS template with data →
 * ask Gotenberg to turn the HTML into a PDF → hand the PDF to the `storage`
 * BC to persist. report-bc never touches S3/MinIO directly — that stays the
 * storage BC's job, reached only over the TCP client below.
 */
@Injectable()
export class InvoicePrintService {
  constructor(
    private readonly logger: LogsService,
    private readonly configService: ConfigService,
    private readonly gotenbergService: GotenbergService,
    private readonly microserviceClient: MicroserviceClientService,
    @Inject(AppMicroservice.Storage.name)
    private readonly storageClient: ClientProxy,
  ) {
    this.logger.setContext(InvoicePrintService.name);
  }

  async printMockInvoice(
    dto: CreateInvoicePrintDTO,
  ): Promise<InvoicePrintResultDTO> {
    const defaults = mockInvoiceDefaults();

    const items = (dto.items?.length ? dto.items : defaults.items).map(
      (item) => {
        const quantity = item.quantity ?? 1;
        const unitPrice = item.unit_price ?? 0;
        const amount = quantity * unitPrice;
        return {
          description_th: item.description_th ?? '-',
          description_en: item.description_en ?? '',
          quantity,
          unit_price_formatted: formatAmount(unitPrice),
          amount_formatted: formatAmount(amount),
          amount,
        };
      },
    );

    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const vat = subtotal * (VAT_RATE / 100);
    const total = subtotal + vat;

    const invoiceNo = dto.invoice_no ?? defaults.invoice_no;

    const html = await ejs.renderFile(TEMPLATE_PATH, {
      invoice_no: invoiceNo,
      invoice_date: dto.invoice_date ?? defaults.invoice_date,
      due_date: dto.due_date ?? defaults.due_date,
      seller: {
        name_th: 'บริษัท อีอาร์พี เดโม จำกัด',
        name_en: 'ERP Demo Co., Ltd.',
        address_th: '999 อาคารเดโม ถนนสาทร กรุงเทพฯ 10120',
        tax_id: '0-1055-56789-01-2',
      },
      customer: {
        name_th: dto.customer_name_th ?? defaults.customer_name_th,
        name_en: dto.customer_name_en ?? defaults.customer_name_en,
        address_th: dto.customer_address_th ?? defaults.customer_address_th,
      },
      items,
      subtotal_formatted: formatAmount(subtotal),
      vat_rate: VAT_RATE,
      vat_formatted: formatAmount(vat),
      total_formatted: formatAmount(total),
      note_th: dto.note_th ?? defaults.note_th,
      note_en: dto.note_en ?? defaults.note_en,
    });

    const pdfBuffer = await this.gotenbergService.convertHtmlToPdf(html);

    const bucket = this.configService.get<string>(
      'STORAGE_S3_BUCKET',
      'erp-storage',
    );
    const file: IPrintFilePayload = {
      originalname: `${invoiceNo}.pdf`,
      mimetype: 'application/pdf',
      buffer: pdfBuffer,
    };

    const uploadResult = await this.microserviceClient.sendWithContext<
      IStorageUploadResult,
      { bucket: string; key: string; file: IPrintFilePayload }
    >(
      this.logger,
      this.storageClient,
      { cmd: AppMicroservice.Storage.cmd.UploadWithMeta },
      { bucket, key: STORAGE_KEY_PREFIX, file },
      null,
    );

    if (!uploadResult) {
      throw new ServiceUnavailableException(
        'Generated the PDF but failed to store it — the storage service is unavailable.',
      );
    }

    const signedUrls = await this.microserviceClient.sendWithContext<
      string[],
      { paths: string[]; filenames?: string[] }
    >(
      this.logger,
      this.storageClient,
      { cmd: AppMicroservice.Storage.cmd.GenerateSignedUrls },
      { paths: [uploadResult.path], filenames: [`${invoiceNo}.pdf`] },
      [],
    );

    return {
      id: randomUUID(),
      invoice_no: invoiceNo,
      path: uploadResult.path,
      bucket: uploadResult.bucket,
      url: signedUrls?.[0] ?? '',
      size: uploadResult.size,
      generated_at: new Date().toISOString(),
    };
  }
}
