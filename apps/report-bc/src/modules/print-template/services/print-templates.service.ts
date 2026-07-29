import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { randomUUID } from 'crypto';

import { ClientProxy } from '@nestjs/microservices';
import { DeepPartial, Repository } from 'typeorm';

import { IUserSession } from '@lib/common/interfaces/auth.interface';
import { AppMicroservice } from '@lib/common/enum/app-microservice.enum';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { MicroserviceClientService } from '@lib/common/services/microservice-client.service';
import { BaseServiceOperations } from '@lib/common/utils/base-operations/base-service-operations.util';
import { ConfigService } from '@lib/config';

import {
  PRINT_TEMPLATE_PAPER_DIMENSIONS_IN,
  PrintTemplatePaperSize,
} from '../constants/print-template.constants';
import { CreatePrintTemplateDTO } from '../dto/create-print-template.dto';
import { PrintTemplateRenderResultDTO } from '../dto/print-template-render-result.dto';
import { UpdatePrintTemplateDTO } from '../dto/update-print-template.dto';
import { PrintTemplate } from '../entities/print-template.entity';
import {
  IPrintTemplateFilePayload,
  IPrintTemplateStorageUploadResult,
} from '../interfaces/storage-upload.interface';
import { GotenbergService } from '../../print/services/gotenberg.service';

const STORAGE_KEY_PREFIX = 'reports/print-templates';
const RENDER_STORAGE_KEY_PREFIX = 'reports/print-template-renders';

/**
 * Owns print-template CRUD. `html_content` never touches Postgres: create/
 * update upload it to the storage BC (MinIO/S3) and persist only the
 * resulting `html_bucket`/`html_path`; `findById` fetches it back from
 * storage for the single-record read the admin edit form needs. List/
 * paginated reads go through the base class untouched and never carry
 * `html_content`.
 */
@Injectable()
export class PrintTemplatesService extends BaseServiceOperations<
  PrintTemplate,
  CreatePrintTemplateDTO,
  UpdatePrintTemplateDTO
> {
  protected readonly allowedRelations: string[] = [];

  constructor(
    protected readonly logger: LogsService,
    private readonly configService: ConfigService,
    private readonly microserviceClient: MicroserviceClientService,
    private readonly gotenbergService: GotenbergService,
    @Inject(AppMicroservice.Storage.name)
    private readonly storageClient: ClientProxy,
    @InjectRepository(PrintTemplate, ErpDatabases.REPORT)
    printTemplateRepository: Repository<PrintTemplate>,
  ) {
    super(printTemplateRepository, {
      logging: {
        logger: logger,
        serviceName: configService.get('REPORT_PREFIX_NAME'),
        serviceVersion: configService.get('REPORT_PREFIX_VERSION'),
      },
    });
  }

  /** Uploads HTML content to storage; throws if the storage service is unreachable. */
  private async uploadHtml(
    code: string,
    htmlContent: string,
  ): Promise<{ bucket: string; path: string }> {
    const bucket = this.configService.get<string>(
      'STORAGE_S3_BUCKET',
      'erp-storage',
    );
    const file: IPrintTemplateFilePayload = {
      originalname: `${code}.html`,
      mimetype: 'text/html',
      buffer: Buffer.from(htmlContent, 'utf-8'),
    };

    const result = await this.microserviceClient.sendWithContext<
      IPrintTemplateStorageUploadResult,
      { bucket: string; key: string; file: IPrintTemplateFilePayload }
    >(
      this.logger,
      this.storageClient,
      { cmd: AppMicroservice.Storage.cmd.UploadWithMeta },
      { bucket, key: STORAGE_KEY_PREFIX, file },
      null,
    );

    if (!result) {
      throw new ServiceUnavailableException(
        'Failed to store the template HTML — the storage service is unavailable.',
      );
    }

    return { bucket: result.bucket, path: result.path };
  }

  /** Best-effort removal of a stale object after an update replaces it. Never throws. */
  private removeHtml(bucket: string, key: string): void {
    void this.microserviceClient
      .sendWithContext<{ message: string }, { bucket: string; key: string }>(
        this.logger,
        this.storageClient,
        { cmd: AppMicroservice.Storage.cmd.Remove },
        { bucket, key },
        null,
      )
      .catch((error: unknown) => {
        this.logger.error(
          'Failed to remove superseded print template HTML object',
          error instanceof Error ? error : undefined,
          { bucket, key },
        );
      });
  }

  /** Fetches the HTML body back from storage via a short-lived signed URL. */
  private async fetchHtml(bucket: string, key: string): Promise<string> {
    const urls = await this.microserviceClient.sendWithContext<
      string[],
      { paths: string[] }
    >(
      this.logger,
      this.storageClient,
      { cmd: AppMicroservice.Storage.cmd.GenerateSignedUrls },
      { paths: [key] },
      null,
    );
    const url = urls?.[0];
    if (!url) {
      throw new ServiceUnavailableException(
        'Failed to load the template HTML — the storage service is unavailable.',
      );
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Storage returned ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      this.logger.error(
        'Failed to fetch print template HTML from storage',
        error instanceof Error ? error : undefined,
        { bucket, key },
      );
      throw new ServiceUnavailableException(
        'Failed to load the template HTML — the storage service is unavailable.',
      );
    }
  }

  async create(
    dto: CreatePrintTemplateDTO,
    currentUser?: IUserSession | string,
  ): Promise<PrintTemplate> {
    const { html_content, ...rest } = dto;
    const uploaded = await this.uploadHtml(rest.code, html_content);

    return this.executeDbOperation(() => {
      const entity = this.typeOrmRepository.create({
        ...rest,
        html_bucket: uploaded.bucket,
        html_path: uploaded.path,
      } as DeepPartial<PrintTemplate>);

      if (currentUser !== undefined) {
        const userId =
          typeof currentUser === 'string' ? currentUser : currentUser.id;
        entity.created_by = userId;
        entity.updated_by = userId;
      }

      return this.typeOrmRepository.save(entity);
    });
  }

  async update(
    id: string,
    dto: UpdatePrintTemplateDTO,
    currentUser?: IUserSession | string,
  ): Promise<PrintTemplate> {
    const { html_content, ...rest } = dto;

    return this.executeDbOperation(async () => {
      // `super.findById` — the raw lookup, not this class's override — so a
      // plain field update never pays for an unneeded storage round-trip to
      // hydrate `html_content`.
      const existing = await super.findById(id);

      let html_bucket = existing.html_bucket;
      let html_path = existing.html_path;
      let superseded: { bucket: string; path: string } | null = null;

      if (html_content !== undefined) {
        const uploaded = await this.uploadHtml(
          rest.code ?? existing.code,
          html_content,
        );
        superseded = { bucket: existing.html_bucket, path: existing.html_path };
        html_bucket = uploaded.bucket;
        html_path = uploaded.path;
      }

      const preloadData: Record<string, unknown> = {
        id,
        ...rest,
        html_bucket,
        html_path,
      };
      if (currentUser !== undefined) {
        preloadData.updated_by =
          typeof currentUser === 'string' ? currentUser : currentUser.id;
      }

      const entityToUpdate = await this.typeOrmRepository.preload(preloadData);
      if (!entityToUpdate) {
        throw new NotFoundException(
          `${this.tableName} with ID '${id}' not found.`,
        );
      }
      const saved = await this.typeOrmRepository.save(entityToUpdate);

      if (superseded) {
        this.removeHtml(superseded.bucket, superseded.path);
      }

      return saved;
    });
  }

  /**
   * Overrides the base lookup to hydrate `html_content` from storage — the
   * only read path that needs it (single-record `GET /:id`, used by the
   * admin edit form to populate its editor).
   */
  async findById(
    id: number | string,
    relations: string[] = [],
  ): Promise<PrintTemplate> {
    const entity = await super.findById(id, relations);
    entity.html_content = await this.fetchHtml(
      entity.html_bucket,
      entity.html_path,
    );
    return entity;
  }

  /**
   * Substitutes every `{{key}}` occurrence in `html`, renders it to PDF at
   * the template's configured paper size, and uploads the PDF to storage —
   * the "generate a real report" counterpart to plain CRUD. Missing keys in
   * `params` fall back to that parameter's `default_value`, then `''`.
   */
  async render(
    id: string,
    params: Record<string, string> = {},
  ): Promise<PrintTemplateRenderResultDTO> {
    const template = await this.findById(id);
    const html = this.substituteParameters(
      template.html_content ?? '',
      template.parameters,
      params,
    );

    const paperSize = this.resolvePaperDimensions(
      template.paper_size,
      template.orientation,
    );
    const pdfBuffer = await this.gotenbergService.convertHtmlToPdf(html, paperSize);

    const bucket = this.configService.get<string>(
      'STORAGE_S3_BUCKET',
      'erp-storage',
    );
    const file: IPrintTemplateFilePayload = {
      originalname: `${template.code}-${randomUUID()}.pdf`,
      mimetype: 'application/pdf',
      buffer: pdfBuffer,
    };

    const uploadResult = await this.microserviceClient.sendWithContext<
      IPrintTemplateStorageUploadResult,
      { bucket: string; key: string; file: IPrintTemplateFilePayload }
    >(
      this.logger,
      this.storageClient,
      { cmd: AppMicroservice.Storage.cmd.UploadWithMeta },
      { bucket, key: RENDER_STORAGE_KEY_PREFIX, file },
      null,
    );
    if (!uploadResult) {
      throw new ServiceUnavailableException(
        'Generated the PDF but failed to store it — the storage service is unavailable.',
      );
    }

    const signedUrls = await this.microserviceClient.sendWithContext<
      string[],
      { paths: string[] }
    >(
      this.logger,
      this.storageClient,
      { cmd: AppMicroservice.Storage.cmd.GenerateSignedUrls },
      { paths: [uploadResult.path] },
      [],
    );

    return {
      id: randomUUID(),
      template_code: template.code,
      path: uploadResult.path,
      bucket: uploadResult.bucket,
      url: signedUrls?.[0] ?? '',
      size: uploadResult.size,
      generated_at: new Date().toISOString(),
    };
  }

  private substituteParameters(
    html: string,
    parameterDefs: PrintTemplate['parameters'],
    params: Record<string, string>,
  ): string {
    return (parameterDefs ?? []).reduce((acc, def) => {
      const value = params[def.key] ?? def.default_value ?? '';
      const escapedKey = def.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return acc.replace(new RegExp(`{{\\s*${escapedKey}\\s*}}`, 'g'), value);
    }, html);
  }

  private resolvePaperDimensions(
    paperSize: string,
    orientation: string,
  ): { widthIn: number; heightIn: number } {
    const dims =
      PRINT_TEMPLATE_PAPER_DIMENSIONS_IN[paperSize as PrintTemplatePaperSize] ??
      PRINT_TEMPLATE_PAPER_DIMENSIONS_IN.A4;
    return orientation === 'landscape'
      ? { widthIn: dims.height, heightIn: dims.width }
      : { widthIn: dims.width, heightIn: dims.height };
  }
}
