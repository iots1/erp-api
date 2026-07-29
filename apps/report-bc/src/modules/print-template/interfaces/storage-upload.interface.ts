/**
 * Mirrors `apps/storage/src/interface/serialized-file-payload.interface.ts` and
 * `upload-with-meta-result.interface.ts` — duplicated locally rather than
 * imported since each app's `src` is private to that app (same reasoning as
 * `apps/report-bc/src/modules/print/interfaces/storage-upload.interface.ts`).
 */
export interface IPrintTemplateFilePayload {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

export interface IPrintTemplateStorageUploadResult {
  path: string;
  bucket: string;
  original_name: string;
  mime_type: string;
  extension: string;
  size: number;
  file_type: string;
}
