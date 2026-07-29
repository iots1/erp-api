import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import type { ImagePayload, IMicroservicePayload } from '@lib/common';
import { AppMicroservice } from '@lib/common/enum/app-microservice.enum';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { RmqAckInterceptor } from '@lib/common/utils/rmq-ack-interceptor.util';

import { ISerializedFilePayload } from './interface/serialized-file-payload.interface';
import { IUploadWithMetaResult } from './interface/upload-with-meta-result.interface';
import { StorageService } from './storage.service';

/**
 * TCP-facing handlers for bucket uploads/removals/presigned URLs. Exceptions
 * thrown by the service bubble to the globally-registered `RpcExceptionsFilter`,
 * which formats them into the standard RPC error envelope — no manual try/catch needed.
 *
 * `RmqAckInterceptor` is mandatory on every RPC controller: the RMQ server is
 * configured with `noAck: false` + `prefetchCount: 1` (see
 * `buildServerOptions`), and NestJS's `ServerRMQ` does *not* ack on the success
 * path — it only nacks when no handler matches. Without this interceptor every
 * handled message stays unacked, so each consumer permanently holds its one
 * prefetched message and the queue head-of-line blocks forever: new requests
 * are never delivered and every caller times out. Mirrors iam-bc's
 * `AccessEventsController`/`AccessKeysRpcController`.
 */
@UseInterceptors(RmqAckInterceptor)
@Controller()
export class StorageEventsController {
  constructor(
    private readonly logger: LogsService,
    private readonly storageService: StorageService,
  ) {}

  @MessagePattern({ cmd: AppMicroservice.Storage.cmd.Upload })
  async uploadFile(
    @Payload()
    data: IMicroservicePayload<{
      bucket: string;
      key: string;
      file: ISerializedFilePayload;
    }>,
  ): Promise<{ path: string }> {
    this.logger.setContextFromPayload(data._context);
    return this.storageService.upload(
      data.payload.bucket,
      data.payload.key,
      data.payload.file,
    );
  }

  @MessagePattern({ cmd: AppMicroservice.Storage.cmd.UploadWithMeta })
  async uploadFileWithMeta(
    @Payload()
    data: IMicroservicePayload<{
      bucket: string;
      key: string;
      file: ISerializedFilePayload;
    }>,
  ): Promise<IUploadWithMetaResult> {
    this.logger.setContextFromPayload(data._context);
    return this.storageService.uploadWithMeta(
      data.payload.bucket,
      data.payload.key,
      data.payload.file,
    );
  }

  @MessagePattern({ cmd: AppMicroservice.Storage.cmd.Remove })
  async deleteFile(
    @Payload()
    data: IMicroservicePayload<{ bucket: string; key: string }>,
  ): Promise<{ message: string }> {
    this.logger.setContextFromPayload(data._context);
    return this.storageService.remove(data.payload.bucket, data.payload.key);
  }

  @MessagePattern({ cmd: AppMicroservice.Storage.cmd.GetPath })
  async getPath(
    @Payload() data: IMicroservicePayload<{ images: ImagePayload[] }>,
  ): Promise<string[]> {
    this.logger.setContextFromPayload(data._context);
    return this.storageService.generateSignedUrlsForImages(data.payload.images);
  }

  @MessagePattern({ cmd: AppMicroservice.Storage.cmd.GenerateSignedUrls })
  async generateSignedUrls(
    @Payload()
    data: IMicroservicePayload<{ paths: string[]; filenames?: string[] }>,
  ): Promise<string[]> {
    this.logger.setContextFromPayload(data._context);
    return this.storageService.generateSignedUrls(
      data.payload.paths,
      data.payload.filenames,
    );
  }
}
