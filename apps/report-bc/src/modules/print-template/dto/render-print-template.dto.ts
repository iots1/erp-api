import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsObject, IsOptional } from 'class-validator';

export class RenderPrintTemplateDTO {
  @IsOptional()
  @IsObject()
  @ApiPropertyOptional({
    description:
      'ค่าตัวแปรสำหรับแทนที่ {{key}} ใน html_content — key ที่ไม่ได้ส่งมาจะใช้ default_value ของ parameter นั้นแทน',
    example: { customer_name: 'บริษัท เอบีซี จำกัด', invoice_no: 'INV-2026-0099' },
  })
  params: Record<string, string>;
}
