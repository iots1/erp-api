import { ApiProperty } from '@nestjs/swagger';

/** Result of `POST /document-types/:id/running-number/next`. */
export class GenerateRunningNumberResultDTO {
  @ApiProperty({ description: 'ID ของประเภทเอกสาร', example: '6007fe4d-...' })
  document_type_id: string;

  @ApiProperty({ description: 'เลขรันที่ออกให้ (ตัวเลขล้วน)', example: 43 })
  running_number: number;

  @ApiProperty({
    description: 'เลขที่เอกสารเต็มที่ออกให้',
    example: 'INV-202607-00043',
  })
  value: string;

  @ApiProperty({
    description: 'เวลาที่ออกเลข (ISO 8601)',
    example: '2026-07-29T10:00:00.000Z',
  })
  generated_at: string;
}
