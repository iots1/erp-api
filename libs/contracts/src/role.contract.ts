import type { IAuditFields } from './common.contract';

export interface ILocalizedText {
  th: string | null;
  en: string | null;
}

/** `roles` resource attributes (iam-bc) as returned by the API. */
export interface IRoleAttributes extends IAuditFields {
  code: string;
  name: ILocalizedText;
  description: string | null;
}

export interface ICreateRolePayload {
  code: string;
  name_th: string;
  name_en: string;
  description?: string | null;
}

export interface IAttachPolicyPayload {
  policy_ids: string[];
}
