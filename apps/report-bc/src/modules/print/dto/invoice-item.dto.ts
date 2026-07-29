import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class InvoiceItemDTO {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'รายการ (ไทย)',
    example: 'ค่าบริการที่ปรึกษาระบบ ERP',
  })
  description_th?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Item description (English)',
    example: 'ERP consulting service',
  })
  description_en?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiPropertyOptional({ description: 'จำนวน', example: 1 })
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiPropertyOptional({ description: 'ราคาต่อหน่วย', example: 15000 })
  unit_price?: number;
}
