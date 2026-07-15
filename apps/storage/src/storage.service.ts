import path from 'path';

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

import { FileAttachmentType, ImagePayload } from '@lib/common';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { ConfigService } from '@lib/config';

import { ISerializedFilePayload } from './interface/serialized-file-payload.interface';
import { IUploadWithMetaResult } from './interface/upload-with-meta-result.interface';

export type { IUploadWithMetaResult };

/**
 * Wraps S3 SDK calls with the exception translation the (@nestjs) global
 * `RpcExceptionsFilter` expects. Kept in the service, not the controller —
 * translating a foreign SDK's error shape into our domain exceptions is
 * "controller-specific context" only in the sense that it's the boundary
 * where an external system's errors become our own.
 */
@Injectable()
export class StorageService {
  private readonly s3Client: S3Client;
  private readonly defaultBucket: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LogsService,
  ) {
    this.logger.setContext(StorageService.name);
    this.defaultBucket = this.configService.get<string>(
      'STORAGE_S3_BUCKET',
    ) as string;

    this.s3Client = new S3Client({
      endpoint: this.configService.get<string>('STORAGE_S3_ENDPOINT'),
      region: this.configService.get<string>('STORAGE_S3_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: this.configService.get<string>(
          'STORAGE_S3_ACCESS_KEY_ID',
        ) as string,
        secretAccessKey: this.configService.get<string>(
          'STORAGE_S3_SECRET_ACCESS_KEY',
        ) as string,
      },
      forcePathStyle: this.configService.get<boolean>(
        'STORAGE_S3_FORCE_PATH_STYLE',
        true,
      ),
    });
  }

  /**
   * Busboy/Multer decodes multipart `Content-Disposition` headers as latin1, so a
   * UTF-8 filename (e.g. Thai) sent by the browser arrives mojibake'd. Re-interpreting
   * the latin1 string as UTF-8 bytes restores the original name.
   */
  private decodeOriginalName(originalname: string): string {
    return Buffer.from(originalname, 'latin1').toString('utf8');
  }

  private translateS3Error(error: unknown, action: string, key: string): never {
    this.logger.error(
      `Failed to ${action} file`,
      error instanceof Error ? error : undefined,
      { key },
    );

    if (error instanceof S3ServiceException) {
      if (error.name === 'NoSuchBucket') {
        throw new NotFoundException(`Bucket does not exist.`);
      }
      if (
        error.name === 'InvalidAccessKeyId' ||
        error.$metadata?.httpStatusCode === 403
      ) {
        throw new ForbiddenException('Invalid S3 credentials provided.');
      }
    }

    if (typeof error === 'object' && error !== null) {
      const err = error as Record<string, unknown>;
      if (err.code === 'ECONNREFUSED' || err.type === 'ECONNRESET') {
        throw new ServiceUnavailableException(
          'Cannot connect to the storage service.',
        );
      }
    }

    throw new ServiceUnavailableException(
      `An unexpected error occurred while trying to ${action} the file.`,
    );
  }

  /** Uploads a file to a bucket, returning the generated object key. */
  async upload(
    bucket: string,
    key: string,
    file: ISerializedFilePayload,
  ): Promise<{ path: string }> {
    const buffer = Buffer.from(file.buffer.data);
    const originalName = this.decodeOriginalName(file.originalname);
    const fileExt = path.extname(originalName);
    const baseName = path.basename(originalName, fileExt);
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const uniqueFileName = `${sanitizedBaseName}-${uuidv4()}${fileExt}`;
    const objectKey = `${key}/${uniqueFileName}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: file.mimetype,
      ContentLength: buffer.length,
    });

    try {
      await this.s3Client.send(command);
      this.logger.info({
        message: `Uploaded file`,
        context: { action: 'STORAGE_UPLOAD', key: objectKey, bucket },
      });
      return { path: objectKey };
    } catch (error) {
      this.translateS3Error(error, 'upload', objectKey);
    }
  }

  /** Removes an object from a bucket. */
  async remove(bucket: string, key: string): Promise<{ message: string }> {
    const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });

    try {
      await this.s3Client.send(command);
      this.logger.info({
        message: `Removed file`,
        context: { action: 'STORAGE_REMOVE', key, bucket },
      });
      return { message: `File '${key}' was successfully removed.` };
    } catch (error) {
      this.translateS3Error(error, 'remove', key);
    }
  }

  /** Returns a presigned URL for a single object key in the default bucket. */
  async getPath(key: string): Promise<{ path: string }> {
    const command = new GetObjectCommand({
      Bucket: this.defaultBucket,
      Key: key,
    });

    try {
      const presignedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 3600,
      });
      return { path: presignedUrl };
    } catch (error) {
      this.translateS3Error(error, 'sign', key);
    }
  }

  /** Resolves presigned URLs for a batch of image references. */
  async generateSignedUrlsForImages(images: ImagePayload[]): Promise<string[]> {
    return Promise.all(
      images.map(async (image) => {
        const command = new GetObjectCommand({
          Bucket: this.defaultBucket,
          Key: image.path,
        });
        return getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
      }),
    );
  }

  /** Uploads a file and returns metadata (size, mime type, kind) alongside its path. */
  async uploadWithMeta(
    bucket: string,
    key: string,
    file: ISerializedFilePayload,
  ): Promise<IUploadWithMetaResult> {
    const { path: storedPath } = await this.upload(bucket, key, file);
    const originalName = this.decodeOriginalName(file.originalname);
    const fileExt = path.extname(originalName).replace('.', '').toLowerCase();
    const size = Buffer.from(file.buffer.data).length;
    const fileType = file.mimetype.startsWith('image/')
      ? FileAttachmentType.IMAGE
      : FileAttachmentType.PDF;

    return {
      path: storedPath,
      bucket,
      original_name: originalName,
      mime_type: file.mimetype,
      extension: fileExt,
      size,
      file_type: fileType,
    };
  }

  /** Resolves presigned URLs for arbitrary object keys, optionally forcing a download filename. */
  async generateSignedUrls(
    paths: string[],
    filenames?: string[],
  ): Promise<string[]> {
    return Promise.all(
      paths.map(async (filePath, i) => {
        const filename = filenames?.[i];
        const command = new GetObjectCommand({
          Bucket: this.defaultBucket,
          Key: filePath,
          ...(filename && {
            ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
          }),
        });
        return getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
      }),
    );
  }
}
