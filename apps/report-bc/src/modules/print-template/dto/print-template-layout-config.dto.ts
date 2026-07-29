import { ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { IsNumber, IsOptional, ValidateNested } from 'class-validator';

class PrintTemplateMarginConfigDTO {
  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ example: 20 })
  top?: number;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ example: 15 })
  bottom?: number;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ example: 10 })
  left?: number;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ example: 10 })
  right?: number;
}

/**
 * Mirrors `IPrintTemplateLayoutConfig` (entities/print-template.entity.ts) —
 * only meaningful when `template_engine = 'banded'`; the paginator falls
 * back to measuring available space itself for any field left unset.
 */
export class PrintTemplateLayoutConfigDTO {
  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({
    description:
      'ความสูง detail band เป็น mm (ไม่ระบุ = ให้ paginator วัดพื้นที่ว่างจริงเอง)',
    example: 180,
  })
  detail_height_mm?: number;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({
    description: 'พื้นที่กันไว้ท้ายหน้าสุดท้ายสำหรับ summary band เป็น mm',
    example: 95,
  })
  reserve_summary_mm?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => PrintTemplateMarginConfigDTO)
  @ApiPropertyOptional({ type: PrintTemplateMarginConfigDTO })
  margin_mm?: PrintTemplateMarginConfigDTO;
}
