import { Check, Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

export type UserRoleAuditAction = 'attached' | 'detached';

/**
 * One row per role assigned to/revoked from a user — users_roles itself
 * (a plain @ManyToMany join table) has no id/audit columns of its own, so
 * this is the only record of "who changed this user's roles, and when"
 * (`created_at`/`created_by` from BaseEntity are the event's timestamp/actor).
 * No FK to users/roles: an audit trail must survive the referenced row
 * being deleted, not cascade away with it.
 */
@Entity({
  name: 'user_role_audit_logs',
  database: ErpDatabases.IAM,
  comment:
    'ประวัติการ assign/revoke role ให้/จาก user (created_at/created_by = เวลา/ผู้กระทำ)',
})
@Index('idx_user_role_audit_logs_user_id', ['user_id'])
@Check(
  'chk_user_role_audit_logs_action',
  `"action" IN ('attached', 'detached')`,
)
export class UserRoleAuditLog extends BaseEntity {
  @Column({ type: 'uuid', comment: 'อ้างอิง users.id (ไม่ผูก FK)' })
  user_id: string;

  @Column({ type: 'uuid', comment: 'อ้างอิง roles.id (ไม่ผูก FK)' })
  role_id: string;

  @Column({ type: 'varchar', length: 10, comment: 'attached | detached' })
  action: UserRoleAuditAction;
}
