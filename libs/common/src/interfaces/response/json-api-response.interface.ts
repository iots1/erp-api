import type { IErrorObject } from './error-object.interface';
import type { ILinks } from './links.interface';
import type { IMeta } from './meta.interface';
import type { IResourceObject } from './resource-object.interface';
import type { IStatus } from './status.interface';

export interface IJsonApiResponse<Attributes = unknown> {
  type?: string;
  status?: IStatus;
  data?: IResourceObject<Attributes> | IResourceObject<Attributes>[] | null;
  errors?: IErrorObject[];
  meta: IMeta;
  links?: ILinks;
  included?: IResourceObject[];
}
