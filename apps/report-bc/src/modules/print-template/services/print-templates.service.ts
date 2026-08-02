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
 * Owns print-template CRUD. `html_content`/`js_content` never touch
 * Postgres: create/update upload them to the storage BC (MinIO/S3) and
 * persist only the resulting `*_bucket`/`*_path`; `findById` fetches both
 * back from storage for the single-record read the admin edit form needs.
 * List/paginated reads go through the base class untouched and never carry
 * either content field.
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

  /** SHA-256 of a content string — lets create/update skip a no-op re-upload. */
  private hashContent(content: string): string {
    return createHash('sha256').update(content, 'utf-8').digest('hex');
  }

  /**
   * Every object belonging to one template — its HTML, its optional JS
   * paginator override, and any future per-template asset — lives under
   * the same `reports/print-templates/<id>/` folder, so an admin (or a
   * future export/backup job) can find everything for one template in one
   * place instead of a flat bucket keyed only by a random suffix.
   */
  private templateStorageKey(id: string): string {
    return `${STORAGE_KEY_PREFIX}/${id}`;
  }

  /** Uploads one template asset (HTML or JS) to storage; throws if the
   * storage service is unreachable. `label` only flavors the error/log text. */
  private async uploadTemplateAsset(
    id: string,
    filename: string,
    mimetype: string,
    content: string,
    label: 'HTML' | 'JavaScript',
  ): Promise<{ bucket: string; path: string }> {
    const bucket = this.configService.get<string>(
      'STORAGE_S3_BUCKET',
      'erp-storage',
    );
    const file: IPrintTemplateFilePayload = {
      originalname: filename,
      mimetype,
      buffer: Buffer.from(content, 'utf-8'),
    };

    const result = await this.microserviceClient.sendWithContext<
      IPrintTemplateStorageUploadResult,
      { bucket: string; key: string; file: IPrintTemplateFilePayload }
    >(
      this.logger,
      this.storageClient,
      { cmd: AppMicroservice.Storage.cmd.UploadWithMeta },
      { bucket, key: this.templateStorageKey(id), file },
      null,
    );

    if (!result) {
      throw new ServiceUnavailableException(
        `Failed to store the template ${label} — the storage service is unavailable.`,
      );
    }

    return { bucket: result.bucket, path: result.path };
  }

  /** Best-effort removal of a stale object after an update replaces it. Never throws. */
  private removeStorageObject(bucket: string, key: string): void {
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
          'Failed to remove superseded print template asset',
          error instanceof Error ? error : undefined,
          { bucket, key },
        );
      });
  }

  /** Fetches one template asset (HTML or JS) back from storage via a
   * short-lived signed URL. `label` only flavors the error/log text. */
  private async fetchTemplateAsset(
    bucket: string,
    key: string,
    label: 'HTML' | 'JavaScript',
  ): Promise<string> {
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
        `Failed to load the template ${label} — the storage service is unavailable.`,
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
      `Failed to fetch print template ${label} from storage`,
      lastError instanceof Error ? lastError : undefined,
      { bucket, key, attempts: maxAttempts, cause },
    );
    throw new ServiceUnavailableException(
      `Failed to load the template ${label} — the storage service is unavailable.`,
    );
  }

  async create(
    dto: CreatePrintTemplateDTO,
    currentUser?: IUserSession | string,
  ): Promise<PrintTemplate> {
    const { html_content, js_content, ...rest } = dto;
    // Generated up front (rather than left to Postgres's column default) so
    // both storage uploads below can key their object path off the same id
    // the row will be saved with — see templateStorageKey().
    const id = randomUUID();

    const uploadedHtml = await this.uploadTemplateAsset(
      id,
      `${rest.code}.html`,
      'text/html',
      html_content,
      'HTML',
    );
    const uploadedJs = js_content
      ? await this.uploadTemplateAsset(
          id,
          `${rest.code}.js`,
          'text/javascript',
          js_content,
          'JavaScript',
        )
      : null;

    return this.executeDbOperation(() => {
      const entity = this.typeOrmRepository.create({
        id,
        ...rest,
        html_bucket: uploadedHtml.bucket,
        html_path: uploadedHtml.path,
        html_hash: this.hashContent(html_content),
        js_bucket: uploadedJs?.bucket ?? null,
        js_path: uploadedJs?.path ?? null,
        js_hash: uploadedJs ? this.hashContent(js_content as string) : null,
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
    const { html_content, js_content, ...rest } = dto;

    return this.executeDbOperation(async () => {
      // `super.findById` — the raw lookup, not this class's override — so a
      // plain field update never pays for an unneeded storage round-trip to
      // hydrate `html_content`/`js_content`.
      const existing = await super.findById(id);

      let html_bucket = existing.html_bucket;
      let html_path = existing.html_path;
      let html_hash = existing.html_hash;
      let supersededHtml: { bucket: string; path: string } | null = null;

      // `existing.html_hash` is null for rows written before this column
      // existed — always re-upload in that case, since there's nothing to
      // compare against yet (it self-heals: the row gets a hash here).
      if (html_content !== undefined) {
        const newHash = this.hashContent(html_content);
        if (newHash !== existing.html_hash) {
          const uploaded = await this.uploadTemplateAsset(
            id,
            `${rest.code ?? existing.code}.html`,
            'text/html',
            html_content,
            'HTML',
          );
          supersededHtml = {
            bucket: existing.html_bucket,
            path: existing.html_path,
          };
          html_bucket = uploaded.bucket;
          html_path = uploaded.path;
          html_hash = newHash;
        }
      }

      let js_bucket = existing.js_bucket;
      let js_path = existing.js_path;
      let js_hash = existing.js_hash;
      let supersededJs: { bucket: string; path: string } | null = null;

      // `js_content === null` (an explicit clear, distinct from `undefined` =
      // "unchanged") drops the override back to the shared paginator; a
      // non-null string re-uploads only when its hash actually changed, same
      // as html_content above.
      if (js_content !== undefined) {
        if (js_content === null) {
          if (existing.js_bucket && existing.js_path) {
            supersededJs = {
              bucket: existing.js_bucket,
              path: existing.js_path,
            };
          }
          js_bucket = null;
          js_path = null;
          js_hash = null;
        } else {
          const newHash = this.hashContent(js_content);
          if (newHash !== existing.js_hash) {
            const uploaded = await this.uploadTemplateAsset(
              id,
              `${rest.code ?? existing.code}.js`,
              'text/javascript',
              js_content,
              'JavaScript',
            );
            if (existing.js_bucket && existing.js_path) {
              supersededJs = {
                bucket: existing.js_bucket,
                path: existing.js_path,
              };
            }
            js_bucket = uploaded.bucket;
            js_path = uploaded.path;
            js_hash = newHash;
          }
        }
      }

      const preloadData: Record<string, unknown> = {
        id,
        ...rest,
        html_bucket,
        html_path,
        html_hash,
        js_bucket,
        js_path,
        js_hash,
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

      if (supersededHtml) {
        this.removeStorageObject(supersededHtml.bucket, supersededHtml.path);
      }
      if (supersededJs) {
        this.removeStorageObject(supersededJs.bucket, supersededJs.path);
      }

      return saved;
    });
  }

  /**
   * Overrides the base lookup to hydrate `html_content`/`js_content` from
   * storage — the only read path that needs them (single-record `GET /:id`,
   * used by the admin edit form to populate its editors).
   */
  async findById(
    id: number | string,
    relations: string[] = [],
  ): Promise<PrintTemplate> {
    const entity = await super.findById(id, relations);
    entity.html_content = await this.fetchTemplateAsset(
      entity.html_bucket,
      entity.html_path,
      'HTML',
    );
    entity.js_content =
      entity.js_bucket && entity.js_path
        ? await this.fetchTemplateAsset(
            entity.js_bucket,
            entity.js_path,
            'JavaScript',
          )
        : null;
    return entity;
  }

  /**
   * Renders arbitrary (typically unsaved) HTML straight to PDF bytes via
   * Gotenberg — no storage upload, no DB read. Backs the admin form's live
   * preview so what the admin sees matches Gotenberg's actual output
   * instead of a browser-only approximation. `'banded'` HTML still carries
   * its raw `<template data-band>` blocks (the browser can't do band
   * substitution), so it goes through `BandedRenderService` first, exactly
   * like a real `render()` call — see `render()` below. `jsContent` is the
   * admin's not-yet-saved paginator override, so a preview mid-edit matches
   * what saving would actually render.
   */
  async previewRender(
    html: string,
    paperSize?: string,
    orientation?: string,
    templateEngine?: string,
    params?: PrintTemplateRenderParams,
    jsContent?: string,
  ): Promise<Buffer> {
    const dims = this.resolvePaperDimensions(
      paperSize ?? 'A4',
      orientation ?? 'portrait',
    );
    const isBanded = templateEngine === 'banded';
    const renderHtml = isBanded
      ? this.bandedRenderService.render(html, params ?? {}, jsContent)
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
   * reviews/print-template-pagination-2026-07-29.md. If the template has its
   * own `js_content` (a per-template paginator override — see
   * `PrintTemplate.js_bucket`), that runs instead of the shared
   * `assets/paginator.inline.js` for documents whose pagination rules
   * genuinely differ from the default.
   */
  async render(
    id: string,
    params: PrintTemplateRenderParams = {},
  ): Promise<PrintTemplateRenderResultDTO> {
    const template = await this.findById(id);
    const isBanded = template.template_engine === 'banded';
    const html = isBanded
      ? this.bandedRenderService.render(
          template.html_content ?? '',
          params,
          template.js_content,
        )
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
