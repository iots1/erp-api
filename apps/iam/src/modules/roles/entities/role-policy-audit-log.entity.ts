import { Check, Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

export type RolePolicyAuditAction = 'attached' | 'detached';

/**
 * One row per policy attached to/detached from a role — roles_policies itself
 * (a plain @ManyToMany join table) has no id/audit columns of its own, so
 * this is the only record of "who changed this role's policies, and when"
 * (`created_at`/`created_by` from BaseEntity are the event's timestamp/actor).
 * No FK to roles/policies: an audit trail must survive the referenced row
 * being deleted, not cascade away with it.
 */
@Entity({
  name: 'role_policy_audit_logs',
  database: ErpDatabases.IAM,
  comment:
    'ประวัติการ attach/detach policy เข้า/ออกจาก role (created_at/created_by = เวลา/ผู้กระทำ)',
})
@Index('idx_role_policy_audit_logs_role_id', ['role_id'])
@Check(
  'chk_role_policy_audit_logs_action',
  `"action" IN ('attached', 'detached')`,
)
export class RolePolicyAuditLog extends BaseEntity {
  @Column({ type: 'uuid', comment: 'อ้างอิง roles.id (ไม่ผูก FK)' })
  role_id: string;

  @Column({ type: 'uuid', comment: 'อ้างอิง policies.id (ไม่ผูก FK)' })
  policy_id: string;

  @Column({ type: 'varchar', length: 10, comment: 'attached | detached' })
  action: RolePolicyAuditAction;
}
