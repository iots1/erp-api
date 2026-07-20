import { Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

import { Policy } from '../../policies/entities/policy.entity';
import { AccessKeyStatus } from '../enums/access-key-status.enum';

@Entity({
  name: 'access_keys',
  database: ErpDatabases.IAM,
  comment:
    'Access Key/Secret Key คู่สำหรับ authenticate แบบ system-to-system (HMAC signature) — ผูกสิทธิ์ผ่าน access_keys_policies',
})
/**
 * Partial unique index instead of a plain column constraint — `access_key_id`
 * must be unique only among *live* rows, so a soft-deleted key's id can be
 * reused (a plain UNIQUE constraint would collide with the soft-deleted row
 * forever, since delete() never touches `access_key_id`).
 */
@Index('uq_access_keys_access_key_id', ['access_key_id'], {
  unique: true,
  where: 'is_deleted = false',
})
export class AccessKey extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 20,
    comment:
      'Public identifier — AKIA + 16 ตัวอักษร A-Z0-9 (unique เฉพาะแถวที่ยังไม่ถูกลบ) — uq_access_keys_access_key_id',
  })
  access_key_id: string;

  @Column({
    type: 'text',
    select: false,
    comment:
      'Secret key เข้ารหัสด้วย AES-256-GCM (iv:authTag:ciphertext, base64) — ไม่ถูก select โดย default',
  })
  secret_key_encrypted: string;

  @Column({
    type: 'uuid',
    comment: 'อ้างอิง owner (iam.users.id หรือ service account id)',
  })
  owner_id: string;

  @Column({
    type: 'varchar',
    length: 20,
    comment: "ประเภทของ owner — ENUM('user', 'service_account')",
  })
  owner_type: 'user' | 'service_account';

  @Column({
    type: 'varchar',
    length: 100,
    comment: 'ชื่อ access key เช่น Warehouse-Integration',
  })
  name: string;

  @Column({
    type: 'text',
    nullable: true,
    default: null,
    comment: 'รายละเอียดการใช้งาน',
  })
  description: string | null;

  @Column({
    type: 'varchar',
    length: 10,
    default: AccessKeyStatus.ACTIVE,
    comment: "สถานะ — ENUM('active', 'inactive', 'revoked')",
  })
  status: AccessKeyStatus;

  @Column({
    type: 'timestamptz',
    nullable: true,
    default: null,
    comment: 'ใช้งานล่าสุดเมื่อ',
  })
  last_used_at: Date | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
    default: null,
    comment: 'วันหมดอายุ — NULL = ไม่มีวันหมดอายุ',
  })
  expires_at: Date | null;

  @Column({
    type: 'jsonb',
    nullable: true,
    default: null,
    comment: 'ข้อมูลเพิ่มเติม เช่น { ip_whitelist: ["192.168.1.0"] }',
  })
  metadata: Record<string, unknown> | null;

  /** Owning side — manages the access_keys_policies join table (access_key_id, policy_id). */
  @ManyToMany(() => Policy, { onDelete: 'CASCADE' })
  @JoinTable({
    name: 'access_keys_policies',
    joinColumn: {
      name: 'access_key_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_access_keys_policies_access_key_id',
    },
    inverseJoinColumn: {
      name: 'policy_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_access_keys_policies_policy_id',
    },
  })
  policies: Policy[];
}
