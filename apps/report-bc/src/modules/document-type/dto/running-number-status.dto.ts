import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Read-only current counter state — `GET /document-types/:id/running-number`. */
export class RunningNumberStatusDTO {
  @ApiProperty({ description: 'ID ของประเภทเอกสาร', example: '6007fe4d-...' })
  document_type_id: string;

  @ApiProperty({
    description: 'เลขรันล่าสุดที่ออกไป (0 ถ้ายังไม่เคยออกเลข)',
    example: 42,
  })
  last_running_number: number;

  @ApiPropertyOptional({
    description: 'เลขที่เอกสารเต็มล่าสุดที่ออกไป',
    example: 'INV-202607-00042',
    nullable: true,
  })
  last_value: string | null;

  @ApiPropertyOptional({
    description: 'เวลาที่ออกเลขล่าสุด (ISO 8601)',
    example: '2026-07-29T10:00:00.000Z',
    nullable: true,
  })
  last_issued_at: string | null;
}
