import {
  ApiPropertyOptional,
  IntersectionType,
  OmitType,
} from '@nestjs/swagger';

import { BaseResponseDTO } from '@lib/common/dto/base-response.dto';

import { CreatePrintTemplateDTO } from './create-print-template.dto';

/**
 * `html_content` is required on create (it's what gets uploaded to storage)
 * but only ever populated in the response for a single-record `GET /:id` —
 * list/paginated responses omit it to stay lightweight. Modeled here as
 * optional rather than reusing `CreatePrintTemplateDTO`'s required field.
 */
export class PrintTemplateResponseDTO extends IntersectionType(
  OmitType(CreatePrintTemplateDTO, ['html_content'] as const),
  BaseResponseDTO,
) {
  @ApiPropertyOptional({
    description:
      'เนื้อหา HTML ปัจจุบัน ดึงจาก object storage — แนบเฉพาะตอนดึงรายการเดียว (GET /:id)',
    example: '<html><body><h1>Invoice</h1></body></html>',
  })
  html_content?: string;
}
