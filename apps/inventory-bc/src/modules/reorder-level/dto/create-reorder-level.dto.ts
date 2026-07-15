import { ApiProperty } from '@nestjs/swagger';

import { IsInt, IsUUID, Min } from 'class-validator';

export class CreateReorderLevelDTO {
  @IsUUID()
  @ApiProperty({ description: 'สินค้าที่เฝ้าระวัง', example: 'a1b2c3d4-...' })
  product_id: string;

  @IsUUID()
  @ApiProperty({
    description: 'คลังที่ตั้งจุดสั่งซื้อ',
    example: 'b2c3d4e5-...',
  })
  warehouse_id: string;

  @IsInt()
  @Min(0)
  @ApiProperty({
    description: 'จำนวนขั้นต่ำ — ต่ำกว่านี้จะแจ้งเตือน',
    example: 10,
  })
  alert_qty: number;
}
