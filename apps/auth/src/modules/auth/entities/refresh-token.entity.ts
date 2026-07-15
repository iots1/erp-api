import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

@Entity({
  name: 'refresh_tokens',
  database: ErpDatabases.AUTH,
  comment: 'ต่ออายุ session · เพิกถอนได้',
})
@Index('idx_refresh_tokens_user_id', ['user_id'])
export class RefreshToken extends BaseEntity {
  @Column({ type: 'uuid', comment: 'อ้างอิง iam.users.id' })
  user_id: string;

  @Column({
    type: 'varchar',
    length: 128,
    unique: true,
    comment: 'sha256 hash ของ refresh token — uq_refresh_tokens_token_hash',
  })
  token_hash: string;

  @Column({ type: 'timestamptz', comment: 'วันหมดอายุ' })
  expires_at: Date;

  @Column({
    type: 'timestamptz',
    nullable: true,
    comment: 'วันที่เพิกถอน (ถ้ามี)',
  })
  revoked_at: Date | null;
}
