import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';

import { ILogger } from '@lib/common/modules/log/abstracts/logger.abstract';

interface DriverError {
  code?: string;
  message?: string;
  detail?: string;
  hint?: string;
  column?: string;
  constraint?: string;
  table?: string;
}

/**
 * Maps PostgreSQL driver errors to NestJS HTTP exceptions.
 * Keeps BaseServiceOperations free of DB-vendor-specific branching (OCP).
 */
export class PostgresErrorMapper {
  constructor(
    private readonly tableName: string,
    private readonly logger: ILogger,
  ) {}

  map(driverError: DriverError): never {
    switch (driverError.code) {
      case '23505':
        return this.handleUniqueViolation(driverError);
      case '23503':
        return this.handleForeignKeyViolation(driverError);
      case '23502':
        return this.handleNotNullViolation(driverError);
      case '22P02':
        return this.handleInvalidTextRepresentation(driverError);
      case '22001':
        return this.handleStringTooLong(driverError);
      default:
        return this.handleUnknown(driverError);
    }
  }

  private handleUniqueViolation(err: DriverError): never {
    this.logger.error(
      `[DB Constraint Violation] Unique constraint violation in ${this.tableName}`,
      undefined,
      {
        detail: err.detail,
        code: '23505',
        table: this.tableName,
        constraint: err.constraint,
      },
    );

    const columnMatch = err.detail?.match(/Key \(([^)]+)\)=/);
    let message: string;

    if (columnMatch?.[1] != null) {
      const columns = columnMatch[1]
        .split(',')
        .map((c) => c.trim().replace(/_/g, ' '))
        .join(' and ');
      message = `A record with this ${columns} already exists.`;
    } else {
      message = 'A record with the provided details already exists.';
    }

    throw new ConflictException({ code: '23505', message });
  }

  private handleForeignKeyViolation(err: DriverError): never {
    const fkTable = err.table ?? this.tableName;
    const fkDetail = err.detail ?? '';

    this.logger.error(
      `[DB Constraint Violation] Foreign key violation in ${fkTable}`,
      undefined,
      {
        detail: fkDetail,
        code: '23503',
        table: fkTable,
        constraint: err.constraint,
      },
    );

    if (fkDetail.includes('is still referenced from table')) {
      const match = fkDetail.match(/is still referenced from table "(\w+)"/);
      const referencedTable =
        match?.[1]?.replace(/_/g, ' ') ?? 'another record';
      throw new ConflictException({
        code: '23503',
        message: `Cannot delete this ${fkTable.replace(/_/g, ' ')} because it is still referenced by ${referencedTable}.`,
      });
    }

    const message =
      err.constraint != null
        ? `Invalid reference for '${err.constraint.replace(/^fk_.*?_/, '').replace(/_/g, ' ')}'. The referenced record does not exist.`
        : `Invalid reference to another record. Please check your input.`;

    throw new BadRequestException({ code: '23503', message });
  }

  private handleNotNullViolation(err: DriverError): never {
    this.logger.error(
      `[DB Constraint Violation] NOT NULL violation in ${this.tableName}`,
      undefined,
      {
        detail: err.detail,
        code: '23502',
        table: this.tableName,
        column: err.column,
      },
    );

    const message =
      err.column != null
        ? `Required field '${err.column}' cannot be empty.`
        : `A required field was left empty. Please check your input.`;

    throw new BadRequestException({ code: '23502', message });
  }

  private handleInvalidTextRepresentation(err: DriverError): never {
    this.logger.error(
      `[DB Constraint Violation] Invalid text representation in ${this.tableName}`,
      undefined,
      { detail: err.detail, code: '22P02', table: this.tableName },
    );
    throw new BadRequestException({
      code: '22P02',
      message: `Invalid format for a field. Please check your input.`,
    });
  }

  private handleStringTooLong(err: DriverError): never {
    this.logger.error(
      `[DB Constraint Violation] String data too long in ${this.tableName}`,
      undefined,
      { detail: err.detail, code: '22001', table: this.tableName },
    );
    throw new BadRequestException({
      code: '22001',
      message: `The value provided for a field is too long. Please shorten the input.`,
    });
  }

  private handleUnknown(err: DriverError): never {
    this.logger.error(
      `[DB Error] Unhandled database error code ${err.code} in ${this.tableName}`,
      undefined,
      {
        detail: err.detail,
        code: err.code,
        hint: err.hint,
        table: this.tableName,
      },
    );
    throw new InternalServerErrorException({
      code: err.code ?? 'DATABASE_ERROR',
      message: `Database error (${err.code ?? 'UNKNOWN'}) on table ${this.tableName}: ${err.message ?? 'Unknown error'}`,
      detail: err.detail,
    });
  }
}
