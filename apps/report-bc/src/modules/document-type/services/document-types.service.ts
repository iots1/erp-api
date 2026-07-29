import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import { IUserSession } from '@lib/common/interfaces/auth.interface';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { BaseServiceOperations } from '@lib/common/utils/base-operations/base-service-operations.util';
import { ConfigService } from '@lib/config';

import { CreateDocumentTypeDTO } from '../dto/create-document-type.dto';
import { GenerateRunningNumberResultDTO } from '../dto/generate-running-number-result.dto';
import { RunningNumberStatusDTO } from '../dto/running-number-status.dto';
import { UpdateDocumentTypeDTO } from '../dto/update-document-type.dto';
import { DocumentRunningNumber } from '../entities/document-running-number.entity';
import { DocumentType } from '../entities/document-type.entity';
import {
  formatRunningNumber,
  parseRunningNumberFormat,
} from '../utils/running-number-format.util';

@Injectable()
export class DocumentTypesService extends BaseServiceOperations<
  DocumentType,
  CreateDocumentTypeDTO,
  UpdateDocumentTypeDTO
> {
  protected readonly allowedRelations: string[] = [];

  constructor(
    protected readonly logger: LogsService,
    configService: ConfigService,
    @InjectRepository(DocumentType, ErpDatabases.REPORT)
    documentTypeRepository: Repository<DocumentType>,
    @InjectRepository(DocumentRunningNumber, ErpDatabases.REPORT)
    private readonly runningNumberRepository: Repository<DocumentRunningNumber>,
  ) {
    super(documentTypeRepository, {
      logging: {
        logger: logger,
        serviceName: configService.get('REPORT_PREFIX_NAME'),
        serviceVersion: configService.get('REPORT_PREFIX_VERSION'),
      },
    });
  }

  async create(
    dto: CreateDocumentTypeDTO,
    currentUser?: IUserSession | string,
  ): Promise<DocumentType> {
    this.validateRunningNumberFormat(dto.has_running_number, dto.running_number_format);
    return super.create(dto, currentUser);
  }

  async update(
    id: string,
    dto: UpdateDocumentTypeDTO,
    currentUser?: IUserSession | string,
  ): Promise<DocumentType> {
    if (dto.has_running_number !== undefined || dto.running_number_format !== undefined) {
      const existing = await super.findById(id);
      const hasRunningNumber = dto.has_running_number ?? existing.has_running_number;
      const format =
        dto.running_number_format !== undefined
          ? dto.running_number_format
          : existing.running_number_format;
      this.validateRunningNumberFormat(hasRunningNumber, format);
    }
    return super.update(id, dto, currentUser);
  }

  /** Throws if a running-number document type is missing/has an invalid format. */
  private validateRunningNumberFormat(
    hasRunningNumber: boolean | undefined,
    format: string | null | undefined,
  ): void {
    if (!hasRunningNumber) return;
    if (!format) {
      throw new BadRequestException(
        'running_number_format is required when has_running_number is true.',
      );
    }
    parseRunningNumberFormat(format, new Date()); // throws BadRequestException if malformed
  }

  /** Read-only counter state — never consumes a number. */
  async getRunningNumberStatus(documentTypeId: string): Promise<RunningNumberStatusDTO> {
    await this.findById(documentTypeId); // 404s if the document type itself doesn't exist
    const counter = await this.runningNumberRepository.findOne({
      where: { document_type_id: documentTypeId },
    });

    return {
      document_type_id: documentTypeId,
      last_running_number: counter?.last_running_number ?? 0,
      last_value: counter?.last_value ?? null,
      last_issued_at: counter?.last_issued_at?.toISOString() ?? null,
    };
  }

  /**
   * Atomically issues the next running number. Runs inside a transaction
   * with a `SELECT ... FOR UPDATE` row lock on the counter row so concurrent
   * callers can never receive the same number — the counter row is created
   * (via `INSERT ... ON CONFLICT DO NOTHING`) before the lock so the very
   * first call for a document type doesn't race on row creation either.
   */
  async generateNextRunningNumber(
    documentTypeId: string,
  ): Promise<GenerateRunningNumberResultDTO> {
    const docType = await this.findById(documentTypeId);
    if (!docType.has_running_number || !docType.running_number_format) {
      throw new BadRequestException(
        'This document type does not use running numbers.',
      );
    }

    return this.executeDbOperation(() =>
      this.typeOrmRepository.manager.transaction(async (manager) => {
        await manager
          .createQueryBuilder()
          .insert()
          .into(DocumentRunningNumber)
          .values({
            document_type_id: documentTypeId,
            last_running_number: 0,
            last_value: null,
            last_issued_at: null,
          })
          .orIgnore()
          .execute();

        const counter = await manager.findOneOrFail(DocumentRunningNumber, {
          where: { document_type_id: documentTypeId },
          lock: { mode: 'pessimistic_write' },
        });

        const now = new Date();
        const { regex, seqDigits } = parseRunningNumberFormat(
          docType.running_number_format as string,
          now,
        );

        const match = counter.last_value ? regex.exec(counter.last_value) : null;
        const nextSeq = match ? Number(match[1]) + 1 : 1;
        const value = formatRunningNumber(
          docType.running_number_format as string,
          now,
          nextSeq,
          seqDigits,
        );

        await manager.update(
          DocumentRunningNumber,
          { document_type_id: documentTypeId },
          { last_running_number: nextSeq, last_value: value, last_issued_at: now },
        );

        return {
          document_type_id: documentTypeId,
          running_number: nextSeq,
          value,
          generated_at: now.toISOString(),
        };
      }),
    );
  }
}
