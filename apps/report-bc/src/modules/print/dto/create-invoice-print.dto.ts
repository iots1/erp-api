import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

import { InvoiceItemDTO } from './invoice-item.dto';

/**
 * Every field is optional so `POST /report/v1/invoices/mock-pdf` with an
 * empty body `{}` renders a fully-populated mock invoice — the quick smoke
 * test this endpoint exists for. Pass real values to preview the template
 * with actual data.
 */
export class CreateInvoicePrintDTO {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'เลขที่ใบแจ้งหนี้',
    example: 'INV-2026-0001',
  })
  invoice_no?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'วันที่ออกใบแจ้งหนี้ (YYYY-MM-DD)',
    example: '2026-07-29',
  })
  invoice_date?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'ครบกำหนดชำระ (YYYY-MM-DD)',
    example: '2026-08-12',
  })
  due_date?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'ชื่อลูกค้า (ไทย)',
    example: 'บริษัท ตัวอย่าง จำกัด',
  })
  customer_name_th?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Customer name (English)',
    example: 'Example Co., Ltd.',
  })
  customer_name_en?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'ที่อยู่ลูกค้า (ไทย)',
    example: '123 ถนนสุขุมวิท แขวงคลองตัน เขตคลองเตย กรุงเทพฯ 10110',
  })
  customer_address_th?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Customer address (English)',
    example: '123 Sukhumvit Rd., Klongtan, Klongtoey, Bangkok 10110',
  })
  customer_address_en?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'หมายเหตุ (ไทย)',
    example: 'ขอบคุณที่ใช้บริการ',
  })
  note_th?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Note (English)',
    example: 'Thank you for your business',
  })
  note_en?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDTO)
  @ApiPropertyOptional({ type: [InvoiceItemDTO] })
  items?: InvoiceItemDTO[];
}
