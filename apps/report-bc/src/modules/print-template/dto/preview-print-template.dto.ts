import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

import {
  PRINT_TEMPLATE_ENGINES,
  PRINT_TEMPLATE_ORIENTATIONS,
  PRINT_TEMPLATE_PAPER_SIZES,
} from '../constants/print-template.constants';
import type { PrintTemplateRenderParams } from './render-print-template.dto';

/**
 * Live-preview render — takes whatever HTML is currently in the admin's
 * editor (not yet saved) and returns the actual Gotenberg-rendered PDF
 * bytes directly, so the preview matches real print output. No storage
 * upload, no DB read/write — purely ephemeral.
 *
 * `template_engine='simple'` (default): `html_content` is already
 * `{{key}}`-substituted client-side — `params` is ignored.
 * `template_engine='banded'`: `html_content` still has its raw
 * `<template data-band>` blocks — the server injects `params` and the
 * paginator script (see `BandedRenderService`) before sending to Gotenberg,
 * since band substitution can't happen in the browser.
 */
export class PreviewPrintTemplateDTO {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description:
      "เนื้อหา HTML ปัจจุบันในตัวแก้ไข (ยังไม่บันทึก) — engine 'simple' แทนที่ {{key}} แล้วจากฝั่ง client, engine 'banded' ยังเป็น <template data-band> ดิบ ให้ server แทนที่",
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

  @IsOptional()
  @IsIn(PRINT_TEMPLATE_ENGINES)
  @ApiPropertyOptional({
    description: "เอนจินที่ใช้ preview — ไม่ระบุ = 'simple'",
    enum: PRINT_TEMPLATE_ENGINES,
    example: 'simple',
  })
  template_engine?: string;

  @IsOptional()
  @IsObject()
  @ApiPropertyOptional({
    description:
      "params สำหรับ band substitution — มีผลเฉพาะ template_engine='banded'",
  })
  params?: PrintTemplateRenderParams;
}
