/**
 * Mirrors `apps/storage/src/interface/serialized-file-payload.interface.ts` and
 * `upload-with-meta-result.interface.ts`. Not imported directly — each BC is an
 * independently deployable unit and never reaches into another app's `src`
 * (same reasoning as `SuppliersProxyService`'s local `SupplierLookupResult`).
 * `buffer` is a real Buffer here; it serializes to the `{ type: 'Buffer', data }`
 * shape storage expects automatically when sent over TCP/RMQ.
 */
export interface IPrintFilePayload {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

export interface IStorageUploadResult {
  path: string;
  bucket: string;
  original_name: string;
  mime_type: string;
  extension: string;
  size: number;
  file_type: string;
}
