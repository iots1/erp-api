import { ApiProperty } from '@nestjs/swagger';

export class PrintTemplateRenderResultDTO {
  @ApiProperty({
    description: 'JSON:API resource id ของเอกสารที่สร้าง',
    example: '653da0c7-936b-4cb5-b3c1-5864564f6eff',
  })
  id: string;

  @ApiProperty({ description: 'รหัสเทมเพลตที่ใช้ render', example: 'invoice' })
  template_code: string;

  @ApiProperty({
    description: 'Object key ที่เก็บไฟล์ไว้ใน storage BC',
    example: 'reports/print-template-renders/invoice-3f9a1c2e.pdf',
  })
  path: string;

  @ApiProperty({ description: 'Bucket ที่เก็บไฟล์', example: 'erp-storage' })
  bucket: string;

  @ApiProperty({
    description: 'Presigned URL สำหรับดาวน์โหลด PDF (หมดอายุใน 1 ชั่วโมง)',
    example: 'http://localhost:9000/erp-storage/reports/print-template-renders/...',
  })
  url: string;

  @ApiProperty({ description: 'ขนาดไฟล์ (bytes)', example: 42_531 })
  size: number;

  @ApiProperty({
    description: 'เวลาที่สร้างเอกสาร (ISO 8601)',
    example: '2026-07-29T10:00:00.000Z',
  })
  generated_at: string;
}
