import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createHash, randomUUID } from 'crypto';

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
import { PrintTemplateRenderParams } from '../dto/render-print-template.dto';
import { UpdatePrintTemplateDTO } from '../dto/update-print-template.dto';
import { PrintTemplate } from '../entities/print-template.entity';
import {
  IPrintTemplateFilePayload,
  IPrintTemplateStorageUploadResult,
} from '../interfaces/storage-upload.interface';
import { GotenbergService } from '../../print/services/gotenberg.service';
import { BandedRenderService } from './banded-render.service';

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
    private readonly bandedRenderService: BandedRenderService,
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

  /** SHA-256 of the HTML body — lets create/update skip a no-op re-upload. */
  private hashHtml(htmlContent: string): string {
    return createHash('sha256').update(htmlContent, 'utf-8').digest('hex');
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

    // 5 attempts / ~3s of backoff — long enough to ride out a short network
    // blip (MinIO still starting up, a brief VPN hiccup) without making an
    // admin page load hang indefinitely on a genuinely dead link.
    const maxAttempts = 5;
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Node's fetch has no default timeout — without this, a connection
        // that's silently dropping packets (a flaky VPN, not a clean
        // refusal) can hang for the OS's full TCP timeout (often 60s+) on
        // a single attempt, defeating the retry loop entirely by never
        // reaching attempt 2. 8s is generous for same-network object storage.
        const response = await fetch(url, {
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) {
          throw new Error(`Storage returned ${response.status}`);
        }
        return await response.text();
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 300));
        }
      }
    }

    // `fetch failed` (a plain TypeError from undici) hides the actual OS-level
    // reason — ECONNREFUSED, ETIMEDOUT, ENOTFOUND — in `error.cause`, which a
    // plain `error.message` log silently drops. Surfacing it here is the
    // difference between "storage is unavailable" (unhelpful, every time)
    // and actually knowing whether the network path to storage was refusing
    // connections, timing out, or failing DNS the next time this happens.
    const cause =
      lastError instanceof Error && 'cause' in lastError
        ? String(lastError.cause)
        : undefined;
    this.logger.error(
      'Failed to fetch print template HTML from storage',
      lastError instanceof Error ? lastError : undefined,
      { bucket, key, attempts: maxAttempts, cause },
    );
    throw new ServiceUnavailableException(
      'Failed to load the template HTML — the storage service is unavailable.',
    );
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
        html_hash: this.hashHtml(html_content),
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
      let html_hash = existing.html_hash;
      let superseded: { bucket: string; path: string } | null = null;

      // `existing.html_hash` is null for rows written before this column
      // existed — always re-upload in that case, since there's nothing to
      // compare against yet (it self-heals: the row gets a hash here).
      if (html_content !== undefined) {
        const newHash = this.hashHtml(html_content);
        if (newHash !== existing.html_hash) {
          const uploaded = await this.uploadHtml(
            rest.code ?? existing.code,
            html_content,
          );
          superseded = {
            bucket: existing.html_bucket,
            path: existing.html_path,
          };
          html_bucket = uploaded.bucket;
          html_path = uploaded.path;
          html_hash = newHash;
        }
      }

      const preloadData: Record<string, unknown> = {
        id,
        ...rest,
        html_bucket,
        html_path,
        html_hash,
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
   * Renders arbitrary (typically unsaved) HTML straight to PDF bytes via
   * Gotenberg — no storage upload, no DB read. Backs the admin form's live
   * preview so what the admin sees matches Gotenberg's actual output
   * instead of a browser-only approximation. `'banded'` HTML still carries
   * its raw `<template data-band>` blocks (the browser can't do band
   * substitution), so it goes through `BandedRenderService` first, exactly
   * like a real `render()` call — see `render()` below.
   */
  async previewRender(
    html: string,
    paperSize?: string,
    orientation?: string,
    templateEngine?: string,
    params?: PrintTemplateRenderParams,
  ): Promise<Buffer> {
    const dims = this.resolvePaperDimensions(
      paperSize ?? 'A4',
      orientation ?? 'portrait',
    );
    const isBanded = templateEngine === 'banded';
    const renderHtml = isBanded
      ? this.bandedRenderService.render(html, params ?? {})
      : html;
    return this.gotenbergService.convertHtmlToPdf(renderHtml, dims, {
      waitForExpression: isBanded
        ? BandedRenderService.WAIT_FOR_EXPRESSION
        : undefined,
    });
  }

  /**
   * Renders the template to PDF and uploads it to storage — the "generate a
   * real report" counterpart to plain CRUD. `'simple'` templates get every
   * `{{key}}` substituted with a plain string (missing keys fall back to
   * that parameter's `default_value`, then `''`); `'banded'` templates hand
   * `params` untouched to `BandedRenderService`, which lets the client-side
   * paginator do its own (dotted-path, array-aware) substitution — see
   * reviews/print-template-pagination-2026-07-29.md.
   */
  async render(
    id: string,
    params: PrintTemplateRenderParams = {},
  ): Promise<PrintTemplateRenderResultDTO> {
    const template = await this.findById(id);
    const isBanded = template.template_engine === 'banded';
    const html = isBanded
      ? this.bandedRenderService.render(template.html_content ?? '', params)
      : this.substituteParameters(
          template.html_content ?? '',
          template.parameters,
          params,
        );

    const paperSize = this.resolvePaperDimensions(
      template.paper_size,
      template.orientation,
    );
    const pdfBuffer = await this.gotenbergService.convertHtmlToPdf(
      html,
      paperSize,
      {
        emulatedMediaType:
          template.emulated_media_type === 'screen' ? 'screen' : 'print',
        waitForExpression: isBanded
          ? BandedRenderService.WAIT_FOR_EXPRESSION
          : undefined,
      },
    );

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

  /** `'simple'`-engine substitution only — flat `{{key}}` replaced with a
   * plain string. A `params[def.key]` that's an array (only meaningful for
   * `'banded'` templates) has no sane flat-string form, so it's treated the
   * same as "not provided" and falls back to `default_value`. */
  private substituteParameters(
    html: string,
    parameterDefs: PrintTemplate['parameters'],
    params: PrintTemplateRenderParams,
  ): string {
    return (parameterDefs ?? []).reduce((acc, def) => {
      const raw = params[def.key];
      const value =
        raw !== undefined && raw !== null && !Array.isArray(raw)
          ? String(raw)
          : (def.default_value ?? '');
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
