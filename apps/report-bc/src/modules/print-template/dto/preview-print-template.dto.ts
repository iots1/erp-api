import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import {
  PRINT_TEMPLATE_ORIENTATIONS,
  PRINT_TEMPLATE_PAPER_SIZES,
} from '../constants/print-template.constants';

/**
 * Live-preview render — takes whatever HTML is currently in the admin's
 * editor (not yet saved) and returns the actual Gotenberg-rendered PDF
 * bytes directly, so the preview matches real print output. No storage
 * upload, no DB read/write — purely ephemeral.
 */
export class PreviewPrintTemplateDTO {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description:
      'เนื้อหา HTML ปัจจุบันในตัวแก้ไข (ยังไม่บันทึก) — แทนที่ {{key}} แล้วจากฝั่ง client',
    example: '<html><body><h1>Invoice</h1></body></html>',
  })
  html_content: string;

  @IsOptional()
  @IsIn(PRINT_TEMPLATE_PAPER_SIZES)
  @ApiPropertyOptional({
    description: 'ขนาดกระดาษสำหรับ render PDF',
    enum: PRINT_TEMPLATE_PAPER_SIZES,
    example: 'A4',
  })
  paper_size?: string;

  @IsOptional()
  @IsIn(PRINT_TEMPLATE_ORIENTATIONS)
  @ApiPropertyOptional({
    description: 'แนวกระดาษ',
    enum: PRINT_TEMPLATE_ORIENTATIONS,
    example: 'portrait',
  })
  orientation?: string;
}
