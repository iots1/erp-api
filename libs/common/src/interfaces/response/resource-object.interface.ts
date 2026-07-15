import type { ILinks } from './links.interface';
import type { IMeta } from './meta.interface';

export interface IResourceObject<Attributes = unknown> {
  id?: string;
  type: string;
  attributes?: Attributes;
  links?: ILinks;
  meta?: IMeta;
}
