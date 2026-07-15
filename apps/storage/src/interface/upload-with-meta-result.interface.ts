import { FileAttachmentType } from '@lib/common';

export interface IUploadWithMetaResult {
  path: string;
  bucket: string;
  original_name: string;
  mime_type: string;
  extension: string;
  size: number;
  file_type: FileAttachmentType;
}
