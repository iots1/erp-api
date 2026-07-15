import type { IAuditFields } from './common.contract';
import type { ILocalizedText } from './role.contract';

export type StatementEffect = 'allow' | 'deny';
export type StatementPlane = 'ui' | 'api';

export interface IStatementCondition {
  operator: string;
  condition_key: string;
  condition_value: string;
}

export interface IPolicyStatementPayload {
  effect: StatementEffect;
  plane: StatementPlane;
  service: string[];
  resource: string[];
  permission_ids: string[];
  conditions?: IStatementCondition[];
}

/** `policies` resource attributes (iam-bc) as returned by the API. */
export interface IPolicyAttributes extends IAuditFields {
  code: string;
  name: ILocalizedText;
  is_active: boolean;
}

export interface ICreatePolicyPayload {
  code: string;
  name_th: string;
  name_en: string;
  is_active?: boolean;
  statements: IPolicyStatementPayload[];
}
