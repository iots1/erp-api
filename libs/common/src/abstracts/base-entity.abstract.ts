import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ITimestamp } from '@lib/common/interfaces/timestamp.interface';

/**
 * Base entity every persisted ERP entity should extend.
 * Provides a UUID primary key, audit timestamps, and soft-delete columns.
 */
export abstract class BaseEntity implements ITimestamp {
  @PrimaryGeneratedColumn('uuid', { comment: 'รหัสอ้างอิงหลัก' })
  id: string;

  @CreateDateColumn({ type: 'timestamptz', comment: 'วันที่สร้าง (system)' })
  created_at: Date;

  @Column({ type: 'uuid', nullable: true, comment: 'ผู้บันทึก' })
  created_by: string | null;

  @UpdateDateColumn({ type: 'timestamptz', comment: 'วันที่แก้ไขล่าสุด' })
  updated_at: Date;

  @Column({ type: 'uuid', nullable: true, comment: 'ผู้แก้ไขล่าสุด' })
  updated_by: string | null;

  @Column({ type: 'boolean', default: false, comment: 'สถานะการลบ' })
  is_deleted: boolean;

  @Column({
    type: 'text',
    nullable: true,
    default: null,
    comment: 'เหตุผลที่ลบข้อมูล',
  })
  deleted_reason: string | null;

  @DeleteDateColumn({
    type: 'timestamptz',
    nullable: true,
    comment: 'วันที่ลบ',
  })
  deleted_at: Date | null;

  @Column({ type: 'uuid', nullable: true, comment: 'ผู้ลบ' })
  deleted_by: string | null;
}
