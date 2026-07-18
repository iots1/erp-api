import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import {
  DeepPartial,
  DeleteResult,
  EntityPropertyNotFoundError,
  FindOneOptions,
  FindOptionsWhere,
  In,
  IsNull,
  ObjectLiteral,
  OptimisticLockVersionMismatchError,
  QueryFailedError,
  Repository,
  UpdateResult,
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity.js';

import { DeleteBulkResponseDTO } from '@lib/common/dto/delete-bulk.dto';
import { QueryParamsDTO } from '@lib/common/dto/query-params.dto';
import { IAuditable } from '@lib/common/interfaces/auditable.interface';
import { IUserSession } from '@lib/common/interfaces/auth.interface';
import { IQueryOptions } from '@lib/common/interfaces/query-options.interface';
import { IPagination } from '@lib/common/interfaces/response/pagination.interface';
import { IResponsePaginatedService } from '@lib/common/interfaces/response/response-service.interface';
import { ISoftDeletable } from '@lib/common/interfaces/soft-deletable.interface';
import { ITimestamp } from '@lib/common/interfaces/timestamp.interface';
import { ILogger } from '@lib/common/modules/log/abstracts/logger.abstract';
import { NoOpLogsService } from '@lib/common/modules/log/logs.service';

import { TypeOrmQueryBuilder } from './typeorm-query-builder.util';

/**
 * Optional knobs for {@link BaseServiceOperations.findPaginated}.
 */
export interface IFindPaginatedOptions {
  /**
   * TypeORM relation load strategy for this query.
   * - `'join'` (TypeORM default): all relations loaded in one query via LEFT JOINs.
   *   On a large result set with a OneToMany relation this fans the row count out
   *   multiplicatively and TypeORM de-duplicates in JS — pathologically slow.
   * - `'query'`: each relation loaded via a separate batched (`WHERE id IN (…)`)
   *   query, then stitched. Avoids the fan-out. Prefer this for list endpoints
   *   that eager-load OneToMany relations over many rows.
   */
  relationLoadStrategy?: 'join' | 'query';
}

/**
 * @description
 * An abstract class for core business logic operations.
 * ...
 */
export abstract class BaseServiceOperations<
  TargetRepository extends ObjectLiteral &
    ITimestamp &
    Partial<IAuditable> &
    Partial<ISoftDeletable>,
  CreateType extends DeepPartial<TargetRepository>,
  UpdateType extends DeepPartial<TargetRepository>,
> {
  /**
   * @description
   * Default relations that are always allowed and merged with service-specific allowedRelations.
   * These typically include audit trail relations like 'created_by', 'updated_by', 'deleted_by'.
   * This is an internal implementation detail and should not be overridden by concrete services.
   * Instead, services should use the allowedRelations property for domain-specific relations.
   * @example
   * private readonly defaultAllowedRelations = ['lookup_created_by', 'lookup_updated_by'];
   */
  private readonly defaultAllowedRelations: string[] = [
    'lookup_created_by',
    'lookup_updated_by',
    'lookup_deleted_by',
  ];

  /**
   * @description
   * A whitelist of relations that can be joined in paginated queries.
   * Each concrete service that needs to allow relation joining via query parameters
   * can override this property to add service-specific relations.
   * These are merged with defaultAllowedRelations via the getFinalAllowedRelations() method.
   * @example
   * protected readonly allowedRelations = ['addresses', 'contacts'];
   */
  protected readonly allowedRelations: string[] = [];

  protected readonly tableName: string;
  private readonly softDeleteFilter = {
    is_deleted: false,
    deleted_at: IsNull(),
  };

  // config about log info
  protected readonly serviceName?: string;
  protected readonly serviceVersion?: string;
  protected readonly logger: ILogger;

  /**
   * @description
   * The constructor for the Base Service.
   * @param typeOrmRepository - The injected TypeORM repository.
   */
  constructor(
    protected readonly typeOrmRepository: Repository<TargetRepository>,
    options?: BaseServiceOptions,
  ) {
    this.tableName = this.typeOrmRepository.metadata.tableName.replace(
      /"/g,
      '',
    );

    if (
      options?.logging !== undefined &&
      options.logging.logger !== undefined
    ) {
      const { logger, serviceName, serviceVersion } = options.logging;

      if (logger === undefined) {
        throw new Error(
          `[${this.constructor.name}] Logging options provided but 'logger' instance is missing. This is a configuration error — check the constructor call.`,
        );
      }

      this.logger = logger;

      if (
        serviceName !== undefined &&
        serviceName.length > 0 &&
        serviceVersion !== undefined &&
        serviceVersion.length > 0
      ) {
        this.logger.setContext(
          `${serviceName} [${this.tableName}]`,
          serviceVersion,
        );
      }
    } else {
      this.logger = new NoOpLogsService();
    }
  }

  /**
   * @description
   * Merges defaultAllowedRelations with service-specific allowedRelations.
   * Prevents duplicates by using a Set and returns a deduplicated array.
   * This method is called wherever allowedRelations is used to ensure
   * both default and service-specific relations are available.
   * @returns A deduplicated array of all allowed relations.
   */
  protected getFinalAllowedRelations(): string[] {
    const merged = new Set([
      ...this.defaultAllowedRelations,
      ...this.allowedRelations,
    ]);
    return Array.from(merged);
  }

  // ===================================================================================
  // SECTION: Private Database Operation Helpers
  // ===================================================================================

  /**
   * @description Creates and saves a new entity to the database.
   * @param data - The data for creating the new entity.
   * @returns A Promise of the created entity.
   */
  private _createEntity(
    data: CreateType,
    user?: IUserSession | string,
  ): Promise<TargetRepository> {
    const entity = this.typeOrmRepository.create(data);
    if (user !== undefined) {
      const userId = typeof user === 'string' ? user : user.id;

      entity.created_by = userId;
      entity.updated_by = userId;
    }
    return this.typeOrmRepository.save(entity);
  }

  /**
   * @description
   * Finds all entities that match the given query criteria, without applying pagination.
   * It leverages TypeOrmQueryBuilder to handle complex filters, sorting, and relations.
   * @param query - The DTO containing filter, sort, and relation parameters.
   * @returns A Promise of an array of all matching entities.
   */
  private _findAllEntities(query: QueryParamsDTO): Promise<TargetRepository[]> {
    const queryBuilder = new TypeOrmQueryBuilder<TargetRepository>(
      this.typeOrmRepository,
      query,
    );
    const findOptions = queryBuilder.build(this.getFinalAllowedRelations());

    delete findOptions.take;
    delete findOptions.skip;

    findOptions.where = {
      ...this.softDeleteFilter,
      ...findOptions.where,
    } as FindOptionsWhere<TargetRepository>;

    return this.typeOrmRepository.find(findOptions);
  }

  /**
   * @description Finds a single entity by given filter criteria.
   * @returns A Promise of the entity or null if not found.
   */
  private async _findOneOrQuery(
    query: QueryParamsDTO,
    options: IQueryOptions = { skipNotFound: false },
  ): Promise<TargetRepository | null> {
    const safeQuery = query ?? {};
    const queryBuilder = new TypeOrmQueryBuilder(
      this.typeOrmRepository,
      safeQuery,
    );
    const findOptions = queryBuilder.build(this.getFinalAllowedRelations());

    // Handle soft delete filter + where clause merge
    // Case 1: where is an array (OR conditions from query.or)
    if (Array.isArray(findOptions.where)) {
      findOptions.where = findOptions.where.map((condition) => ({
        ...this.softDeleteFilter,
        ...condition,
      }));
    } else {
      // Case 2: where is an object (AND conditions from query.s/filter)
      findOptions.where = {
        ...this.softDeleteFilter,
        ...findOptions.where,
      } as FindOptionsWhere<TargetRepository>;
    }

    const entity = await this.typeOrmRepository.findOne(findOptions);

    if (
      (entity === undefined || entity === null) &&
      options?.skipNotFound !== true
    ) {
      throw new NotFoundException(
        `${this.tableName} with filter '${safeQuery.filter?.toString()}' not found.`,
      );
    }

    return entity;
  }

  /**
   * @description Finds a single entity by its ID.
   * @param id - The ID of the entity.
   * @returns A Promise of the entity or null if not found.
   */
  private _findEntityById(
    id: number | string,
    relations: string[] = [],
  ): Promise<TargetRepository | null> {
    const filter: FindOneOptions<TargetRepository> = {
      where: {
        id,
        ...this.softDeleteFilter,
      } as unknown as FindOptionsWhere<TargetRepository>,
      relations: relations,
    };

    return this.typeOrmRepository.findOne(filter);
  }

  /**
   * @description
   * Finds entities with pagination by delegating query building to the TypeOrmQueryBuilder.
   * @param query - The DTO containing all query parameters.
   * @returns A promise of an object containing the data and pagination metadata.
   */
  private async _findEntitiesWithPagination(
    query: QueryParamsDTO,
    options?: IFindPaginatedOptions,
  ): Promise<{ data: TargetRepository[]; pagination: IPagination }> {
    const safeQuery = query ?? {};
    const queryBuilder = new TypeOrmQueryBuilder(
      this.typeOrmRepository,
      safeQuery,
    );
    const findOptions = queryBuilder.build(this.getFinalAllowedRelations());

    // Opt-in: split relation loading into separate batched queries instead of
    // one fan-out JOIN (see IFindPaginatedOptions). Applies to every branch
    // below since findOptions is shared.
    if (options?.relationLoadStrategy !== undefined) {
      findOptions.relationLoadStrategy = options.relationLoadStrategy;
    }

    // Handle soft delete filter + where clause merge
    // Case 1: where is an array (OR conditions from query.or)
    if (Array.isArray(findOptions.where)) {
      findOptions.where = findOptions.where.map((condition) => ({
        ...this.softDeleteFilter,
        ...condition,
      }));
    } else {
      // Case 2: where is an object (AND conditions from query.s/filter)
      findOptions.where = {
        ...this.softDeleteFilter,
        ...findOptions.where,
      } as FindOptionsWhere<TargetRepository>;
    }

    const limit = findOptions.take ?? 10;
    const page = Number(safeQuery.page) || 1;

    // ---------------------------------------------------------
    // enhance case : get_count_only mode
    // ---------------------------------------------------------
    if (safeQuery.get_count_only === true) {
      // const [total, totalRecord] = await Promise.all([
      //     this.typeOrmRepository.count({ where: findOptions.where }),
      //     this.typeOrmRepository.count({
      //         where: this.softDeleteFilter as FindOptionsWhere<TargetRepository>,
      //     }),
      // ]);

      // return {
      //     data: [],
      //     pagination: {
      //         page: page,
      //         page_size: limit,
      //         total,
      //         total_records: totalRecord,
      //         total_pages: Math.ceil(total / limit),
      //     },
      // };

      const [total] = await Promise.all([
        this.typeOrmRepository.count({ where: findOptions.where }),
      ]);

      return {
        data: [],
        pagination: {
          page: page,
          page_size: limit,
          total,
          total_records: total,
          total_pages: Math.ceil(total / limit),
        },
      };
    }

    // ignore_limit: fetch all rows that match the filter (no pagination cap).
    // Remove take/skip so findAndCount returns every matching row; the
    // returned `total` is the filtered count — no separate count needed.
    if (safeQuery.ignore_limit === true) {
      findOptions.take = undefined;
      findOptions.skip = undefined;
      const [entities, total] =
        await this.typeOrmRepository.findAndCount(findOptions);

      return {
        data: entities,
        pagination: {
          page: page,
          page_size: entities.length,
          total,
          total_records: total,
          total_pages: 1,
        },
      };
    }

    // Normal paginated case: a separate unfiltered totalRecord count was previously run
    // alongside findAndCount, tripling DB round-trips per request. Reuse the filtered
    // `total` for `total_records` instead (same simplification already applied to the
    // get_count_only branch above).
    const [entities, total] =
      await this.typeOrmRepository.findAndCount(findOptions);

    return {
      data: entities,
      pagination: {
        page: page,
        page_size: limit,
        total,
        total_records: total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * @description Loads an existing entity by ID and merges new data onto it (without saving).
   * @param id - The ID of the entity to update.
   * @param data - The new data to merge.
   * @returns A Promise of the merged entity or undefined if not found.
   */
  private _preloadAndUpdate(
    id: string | number,
    data: UpdateType,
    user?: IUserSession | string,
  ): Promise<TargetRepository | undefined> {
    const dataToPreload: Record<string, unknown> = { ...data };
    if (user !== undefined) {
      const userId = typeof user === 'string' ? user : user.id;
      dataToPreload.updated_by = userId;
    }

    return this.typeOrmRepository.preload({
      id: id,
      ...dataToPreload,
    } as unknown as DeepPartial<TargetRepository>);
  }

  /**
   * @description Saves an entity to the database (can be used for both create and update).
   * @param entity - The entity to save.
   * @returns A Promise of the saved entity.
   */
  private _saveEntity(entity: TargetRepository): Promise<TargetRepository> {
    return this.typeOrmRepository.save(entity);
  }

  /**
   * @description Deletes an entity from the database.
   * @param id - The ID of the entity to delete.
   * @param softDelete - Manual softDelete update is_deleted and deleted_at
   * @returns A Promise of the DeleteResult.
   */
  private _deleteEntity(
    id: string | number,
    softDelete: boolean,
    user?: IUserSession | string,
  ): Promise<DeleteResult | UpdateResult> {
    if (softDelete) {
      const updateData: Record<string, unknown> = {
        is_deleted: true,
        deleted_at: new Date(),
      };

      if (user !== undefined) {
        const userId = typeof user === 'string' ? user : user.id;
        updateData.deleted_by = userId;
      }

      return this.typeOrmRepository.update(
        id,
        updateData as QueryDeepPartialEntity<TargetRepository>,
      );
    } else {
      return this.typeOrmRepository.delete(id);
    }
  }

  /**
   * @description Creates multiple entities in bulk and saves them to the database.
   * @param dataArray - Array of data objects for creating new entities.
   * @param user - Optional user session for audit tracking.
   * @returns A Promise of the created entities.
   */
  private _createBulkEntities(
    dataArray: CreateType[],
    user?: IUserSession | string,
  ): Promise<TargetRepository[]> {
    const userId =
      user !== undefined
        ? typeof user === 'string'
          ? user
          : user.id
        : undefined;

    const entities = dataArray.map((data) => {
      const entity = this.typeOrmRepository.create(data);
      if (userId !== undefined) {
        entity.created_by = userId;
        entity.updated_by = userId;
      }
      return entity;
    });

    return this.typeOrmRepository.save(entities);
  }

  /**
   * @description Updates multiple entities in bulk with create/update/delete semantics.
   * - Items with `id` that exist: Updated
   * - Items without `id`: Created
   * - Existing items not in dataArray: Soft deleted
   *
   * @param dataArray - Array of items to create or update
   * @param filter - Filter to scope existing entities
   * @param user - Optional user for audit tracking
   * @returns Promise of saved entities
   */
  private async _updateBulkEntities(
    dataArray: (CreateType | UpdateType)[],
    filter: Record<string, unknown>,
    user?: IUserSession | string,
    options?: { skipDelete?: boolean },
  ): Promise<TargetRepository[]> {
    if (dataArray.length === 0) {
      return [];
    }

    const userId = this._extractUserId(user);
    const skipDelete = options?.skipDelete === true;

    // Runs inside a transaction: create/update/reconcile-delete must land atomically,
    // otherwise a mid-batch failure leaves the desired-state reconcile half-applied.
    return this.typeOrmRepository.manager.transaction(
      async (transactionalManager) => {
        const txRepo = transactionalManager.getRepository<TargetRepository>(
          this.typeOrmRepository.target,
        );

        // 1. Fetch existing entities matching the filter (skipped when the caller
        // has determined the incoming batch cannot safely reconcile deletions,
        // e.g. it does not carry a scope narrow enough to diff against)
        const existingEntities = skipDelete
          ? []
          : await this._fetchExistingEntities(
              {
                ...filter,
                ...this.softDeleteFilter,
              },
              txRepo,
            );

        // 2. Categorize incoming data
        const { toCreate, toUpdate, incomingIds } =
          this._categorizeIncomingData(dataArray);

        // 3. Identify entities to delete
        const idsToDelete = skipDelete
          ? []
          : existingEntities
              .filter((entity) => !incomingIds.has(String(entity.id)))
              .map((entity) => String(entity.id));

        // 4. Process all operations
        // แยก _processCreates ออกมาเพราะเป็น Synchronous (ป้องกัน eslint await-thenable)
        const createdEntities = this._processCreates(
          toCreate,
          filter,
          userId,
          txRepo,
        );

        // รันเฉพาะที่เป็น Async ใน Promise.all
        const [updatedEntities] = await Promise.all([
          this._processUpdates(toUpdate, userId, txRepo),
          this._processDeletes(
            idsToDelete,
            user,
            'delete with bulk reconcile',
            txRepo,
          ),
        ]);

        // 5. Save all entities
        const entitiesToSave = [...createdEntities, ...updatedEntities];

        if (entitiesToSave.length === 0) {
          return [];
        }

        // ใช้ Type Assertion เพื่อแก้ปัญหา Generic Overload ของ TypeORM
        return txRepo.save(entitiesToSave as DeepPartial<TargetRepository>[]);
      },
    );
  }

  /**
   * @description Extracts user ID from session or string
   */
  private _extractUserId(user?: IUserSession | string): string | undefined {
    if (user === undefined) return undefined;
    return typeof user === 'string' ? user : (user.id ?? undefined);
  }

  /**
   * @description Fetches existing entities matching the filter
   */
  private async _fetchExistingEntities(
    filter: Record<string, unknown>,
    repo: Repository<TargetRepository> = this.typeOrmRepository,
  ): Promise<TargetRepository[]> {
    return repo.find({
      where: {
        ...this.softDeleteFilter,
        ...filter,
      } as FindOptionsWhere<TargetRepository>,
    });
  }

  /**
   * @description Categorizes incoming data into items to create vs update
   */
  private _categorizeIncomingData(dataArray: (CreateType | UpdateType)[]): {
    toCreate: CreateType[];
    toUpdate: UpdateType[];
    incomingIds: Set<string>;
  } {
    const toCreate: CreateType[] = [];
    const toUpdate: UpdateType[] = [];
    const incomingIds = new Set<string>();

    for (const item of dataArray) {
      const itemWithId = item as { id?: string | number };

      if (itemWithId.id != null) {
        incomingIds.add(String(itemWithId.id));
        toUpdate.push(item as UpdateType);
      } else {
        toCreate.push(item as CreateType);
      }
    }

    return { toCreate, toUpdate, incomingIds };
  }

  /**
   * @description Creates new entities from the provided data
   */
  private _processCreates(
    toCreate: CreateType[],
    filter: Record<string, unknown>,
    userId?: string,
    repo: Repository<TargetRepository> = this.typeOrmRepository,
  ): TargetRepository[] {
    return toCreate.map((data) => {
      const entity = repo.create({
        ...data,
        ...filter,
      } as DeepPartial<TargetRepository>);

      if (userId !== undefined) {
        (entity as unknown as IAuditable).created_by = userId;
        (entity as unknown as IAuditable).updated_by = userId;
      }

      return entity;
    });
  }

  /**
   * @description Preloads and prepares entities for update
   */
  private async _processUpdates(
    toUpdate: UpdateType[],
    userId?: string,
    repo: Repository<TargetRepository> = this.typeOrmRepository,
  ): Promise<TargetRepository[]> {
    if (toUpdate.length === 0) {
      return [];
    }

    const updatePromises = toUpdate.map((data) => {
      const preloadData =
        userId !== undefined ? { ...data, updated_by: userId } : data;

      return repo.preload(preloadData);
    });

    const results = await Promise.all(updatePromises);

    // แก้ไข Type Predicate Error:
    // ใช้การตรวจสอบความมีอยู่จริงและ Cast กลับเป็น TargetRepository[] โดยตรง
    return results.filter((entity) => entity !== undefined && entity !== null);
  }

  /**
   * @description Soft deletes entities by IDs
   */
  private async _processDeletes(
    idsToDelete: string[],
    user?: IUserSession | string,
    reason?: string,
    repo: Repository<TargetRepository> = this.typeOrmRepository,
  ): Promise<void> {
    if (idsToDelete.length === 0) {
      return;
    }

    await this._deleteBulkEntities(idsToDelete, true, user, reason, repo);
  }

  private _deleteBulkEntities(
    ids: string[],
    softDelete: boolean,
    user?: IUserSession | string,
    reason?: string,
    repo: Repository<TargetRepository> = this.typeOrmRepository,
  ): Promise<UpdateResult | DeleteResult> {
    if (softDelete) {
      const updateData: Record<string, unknown> = {
        is_deleted: true,
        deleted_at: new Date(),
      };

      if (user !== undefined) {
        const userId = typeof user === 'string' ? user : user.id;
        updateData.deleted_by = userId;
      }

      if (reason !== undefined) {
        updateData.deleted_reason = reason;
      }

      // Scope to still-active rows so ids already soft-deleted by a
      // prior call (e.g. a separate reconcile-delete) don't get their
      // deleted_at/deleted_by re-stamped with this call's timestamp/user.
      return repo.update(
        {
          id: In(ids),
          ...this.softDeleteFilter,
        } as unknown as FindOptionsWhere<TargetRepository>,
        updateData as QueryDeepPartialEntity<TargetRepository>,
      );
    } else {
      return repo.delete(ids);
    }
  }

  // ===================================================================================
  // SECTION: Central Exception Handling Wrapper
  // ===================================================================================

  /**
   * @description
   * A wrapper function that executes all database operations.
   * It provides centralized error handling for common database exceptions.
   * @param operation - A function that returns a Promise of the database operation result.
   * @returns The result of the database operation.
   */
  protected async executeDbOperation<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error instanceof EntityPropertyNotFoundError) {
        throw new BadRequestException({
          code: 'INVALID_PROPERTY',
          message: error.message,
        });
      }

      if (error instanceof OptimisticLockVersionMismatchError) {
        throw new ConflictException({
          code: 'OPTIMISTIC_LOCK_CONFLICT',
          message: `The record was modified by another user. Please refresh and try again. Conflicting table: ${this.tableName}`,
        });
      }

      if (error instanceof QueryFailedError) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const driverError = error.driverError;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        console.error(`Database Error Code: ${driverError?.code}`, driverError);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        switch (driverError?.code) {
          // Postgres error code for unique constraint violation.
          case '23505': {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const constraintName = driverError.constraint as string | undefined;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const pgDetail = driverError.detail as string | undefined;

            this.logger.error(
              `[DB Constraint Violation] Unique constraint violation in ${this.tableName}`,
              error,
              {
                detail: pgDetail,
                code: '23505',
                table: this.tableName,
                constraint: constraintName,
              },
            );

            // Postgres detail format: "Key (col1, col2)=(val1, val2) already exists."
            // Extract column names directly — more reliable than parsing the constraint name.
            const columnMatch = pgDetail?.match(/Key \(([^)]+)\)=/);
            let errorMessage: string;

            if (columnMatch?.[1] != null) {
              const columns = columnMatch[1]
                .split(',')
                .map((c) => c.trim().replace(/_/g, ' '))
                .join(' and ');
              errorMessage = `A record with this ${columns} already exists.`;
            } else {
              errorMessage =
                'A record with the provided details already exists.';
            }

            throw new ConflictException({
              code: '23505',
              message: errorMessage,
            });
          }
          // Postgres error code for foreign key violation.
          case '23503': {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const fkConstraintName = driverError.constraint as
              string | undefined;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const fkDetail = (driverError.detail as string) ?? '';
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const fkTable = (driverError.table as string) ?? this.tableName;

            this.logger.error(
              `[DB Constraint Violation] Foreign key violation in ${fkTable}`,
              error,
              {
                detail: fkDetail,
                code: '23503',
                table: fkTable,
                constraint: fkConstraintName,
              },
            );

            // DELETE blocked: "Key (id)=(x) is still referenced from table "xxx""
            if (fkDetail.includes('is still referenced from table')) {
              const referencedTable = fkDetail.match(
                /is still referenced from table "(\w+)"/,
              );
              const friendlyTable =
                referencedTable?.[1]?.replace(/_/g, ' ') ?? 'another record';

              throw new ConflictException({
                code: '23503',
                message: `Cannot delete this ${fkTable.replace(/_/g, ' ')} because it is still referenced by ${friendlyTable}.`,
              });
            }

            // INSERT/UPDATE: referenced record does not exist
            const fkErrorMessage =
              fkConstraintName !== undefined
                ? `Invalid reference for '${fkConstraintName.replace(/^fk_.*?_/, '').replace(/_/g, ' ')}'. The referenced record does not exist.`
                : `Invalid reference to another record. Please check your input.`;

            throw new BadRequestException({
              code: '23503',
              message: fkErrorMessage,
            });
          }
          // Postgres error code for not-null violation.
          case '23502': {
            // Extract column name from error
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const columnName = driverError.column as string | undefined;

            // Log full details internally for debugging
            this.logger.error(
              `[DB Constraint Violation] NOT NULL violation in ${this.tableName}`,
              error,
              {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                detail: driverError.detail,
                code: '23502',
                table: this.tableName,
                column: columnName,
              },
            );

            const errorMessage =
              columnName !== undefined
                ? `Required field '${columnName}' cannot be empty.`
                : `A required field was left empty. Please check your input.`;

            throw new BadRequestException({
              code: '23502',
              message: errorMessage,
            });
          }
          // Postgres error code for invalid text representation (e.g., wrong UUID format).
          case '22P02': {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const pgDetail = driverError.detail as string | undefined;
            // The caller sent a value Postgres can't parse for the target type
            // (e.g. a bad uuid/int, or a URL-encoded enum like "Present%20Illness"
            // in a filter). That's a 400 — client input, not a server fault — so
            // log at warn to keep it out of the error dashboards, then surface a
            // clean BadRequest.
            this.logger.warn({
              message: `[Invalid input] Invalid text representation in ${this.tableName}`,
              context: { code: '22P02', table: this.tableName },
              details: pgDetail,
            });
            throw new BadRequestException({
              code: '22P02',
              message: `Invalid format for a field. Please check your input.`,
            });
          }
          case '22001': {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const pgDetail = driverError.detail as string | undefined;
            // Value longer than the column allows — client input (400), not a
            // server fault. Log at warn so it doesn't pollute error dashboards.
            this.logger.warn({
              message: `[Invalid input] String data too long in ${this.tableName}`,
              context: { code: '22001', table: this.tableName },
              details: pgDetail,
            });
            throw new BadRequestException({
              code: '22001',
              message: `The value provided for a field is too long. Please shorten the input.`,
            });
          }
          default: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const dbCode = driverError?.code as string | undefined;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const dbMessage = driverError?.message as string | undefined;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const dbDetail = driverError?.detail as string | undefined;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const dbHint = driverError?.hint as string | undefined;

            this.logger.error(
              `[DB Error] Unhandled database error code ${dbCode} in ${this.tableName}`,
              error,
              {
                detail: dbDetail,
                code: dbCode,
                hint: dbHint,
                table: this.tableName,
              },
            );

            throw new InternalServerErrorException({
              code: dbCode ?? 'DATABASE_ERROR',
              message: `Database error (${dbCode ?? 'UNKNOWN'}) on table ${this.tableName}: ${dbMessage ?? 'Unknown error'}`,
              detail: dbDetail,
            });
          }
        }
      }
      // Re-throw any other non-database errors.
      throw error;
    }
  }

  // ===================================================================================
  // SECTION: Public API Methods
  // ===================================================================================

  async create(
    data: CreateType,
    currentUser?: IUserSession | string,
  ): Promise<TargetRepository> {
    return this.executeDbOperation(() => this._createEntity(data, currentUser));
  }

  async findAll(query: QueryParamsDTO): Promise<TargetRepository[]> {
    return this.executeDbOperation(() => this._findAllEntities(query));
  }

  async findOneOrQuery(
    query: QueryParamsDTO,
    options?: IQueryOptions,
  ): Promise<TargetRepository | null> {
    return this.executeDbOperation(() => this._findOneOrQuery(query, options));
  }

  async findById(
    id: number | string,
    relations: string[] = [],
  ): Promise<TargetRepository> {
    const entity = await this.executeDbOperation(() =>
      this._findEntityById(id, relations),
    );
    if (!entity) {
      throw new NotFoundException(
        `${this.tableName} with ID '${id}' not found.`,
      );
    }
    return entity;
  }
  /**
   * @description Finds entities with pagination, sorting, and filtering capabilities.
   * @param query - The DTO containing pagination, sorting, and filtering parameters.
   * @returns An object containing the data and pagination metadata.
   */
  async findPaginated(
    query: QueryParamsDTO,
    options?: IFindPaginatedOptions,
  ): Promise<IResponsePaginatedService<TargetRepository[]>> {
    return this.executeDbOperation(() =>
      this._findEntitiesWithPagination(query, options),
    );
  }
  /**
   * @description Updates an existing entity by its ID.
   *
   * Runs inside a transaction to guarantee consistency across all operations.
   *
   * Handles three relation types via TypeORM metadata:
   * - **Scalar fields**: merged via `preload()` + `save()`
   * - **OneToMany**: extracted before `preload()`, saved directly via child repository
   *   with FK explicitly set. Bypasses cascade entirely to avoid TypeORM's internal
   *   FK-null issue when mixing `preload()` with cascade OneToMany children.
   * - **ManyToMany (owning side)**: stripped before `preload()`, synced after `save()`
   *   via `addAndRemove()` to avoid duplicate-key errors on junction tables.
   *   Soft-deleted related records are excluded from the diff.
   *
   * @param id - The ID of the entity to update.
   * @param data - The DTO containing the data to update.
   * @param currentUser - Optional user session or ID for audit tracking.
   * @param options - Optional update options controlling orphaned OneToMany children handling.
   *   - `hardDeleteOneToMany`: permanently DELETE orphaned child rows.
   *   - `softDeleteOneToMany`: soft-delete orphaned child rows (is_deleted=true, deleted_reason='delete with cascade').
   *   If the children key is omitted from the DTO, no orphan handling runs (REST PATCH semantics).
   * @returns The updated entity.
   * @throws {NotFoundException} If no entity with the given ID is found.
   */
  async update(
    id: string,
    data: UpdateType,
    currentUser?: IUserSession | string,
    options?: IUpdateOptions,
  ): Promise<TargetRepository> {
    return this.executeDbOperation(() =>
      this.typeOrmRepository.manager.transaction(
        async (transactionalManager) => {
          const txRepo = transactionalManager.getRepository<TargetRepository>(
            this.typeOrmRepository.target,
          );

          const metadata = this.typeOrmRepository.metadata;
          const dataRecord: Record<string, unknown> = { ...data };

          // ── 1. Identify relation types from entity metadata ──
          const manyToManyRelations = metadata.relations.filter(
            (r) => r.isManyToMany && r.isOwning,
          );
          const oneToManyRelations = metadata.relations.filter(
            (r) => r.isOneToMany,
          );

          // ── 2. Extract ManyToMany data from DTO ──
          const manyToManyPayload: Record<string, Array<{ id: string }>> = {};
          for (const rel of manyToManyRelations) {
            if (rel.propertyName in dataRecord) {
              manyToManyPayload[rel.propertyName] = dataRecord[
                rel.propertyName
              ] as Array<{ id: string }>;
              delete dataRecord[rel.propertyName];
            }
          }

          // ── 3. Extract OneToMany data from DTO (prevent preload from caching null FK) ──
          // Track which OneToMany relations were explicitly sent in DTO (even if empty)
          const explicitlySetOneToMany = new Set<string>();
          const oneToManyPayload: Record<string, unknown[]> = {};
          for (const rel of oneToManyRelations) {
            if (rel.propertyName in dataRecord) {
              explicitlySetOneToMany.add(rel.propertyName);
              oneToManyPayload[rel.propertyName] = dataRecord[
                rel.propertyName
              ] as unknown[];
              delete dataRecord[rel.propertyName];
            }
          }

          // ── 4. Preload entity with scalar fields only ──
          const preloadData: Record<string, unknown> = { id, ...dataRecord };
          if (currentUser !== undefined) {
            const userId =
              typeof currentUser === 'string' ? currentUser : currentUser.id;
            preloadData.updated_by = userId;
          }
          const entityToUpdate = await txRepo.preload(
            preloadData as unknown as DeepPartial<TargetRepository>,
          );

          if (!entityToUpdate) {
            throw new NotFoundException(
              `${this.tableName} with ID '${id}' not found.`,
            );
          }

          // ── 5. Save parent entity (scalar fields only, no cascade on OneToMany) ──
          const saved = await txRepo.save(entityToUpdate);

          // ── 6. Handle OneToMany via child repositories (bypass cascade) ──
          if (Object.keys(oneToManyPayload).length > 0) {
            for (const rel of oneToManyRelations) {
              const incomingChildren = oneToManyPayload[rel.propertyName];
              if (!Array.isArray(incomingChildren)) continue;

              const inverseRelation = rel.inverseRelation;
              if (
                inverseRelation == null ||
                inverseRelation.joinColumns.length === 0
              )
                continue;

              // Resolve FK property name on child entity via join column metadata
              const fkDbName = inverseRelation.joinColumns[0].databaseName;
              const fkColumn = rel.inverseEntityMetadata.columns.find(
                (c) => c.databaseName === fkDbName,
              );
              if (fkColumn == null) continue;

              const childRepo = transactionalManager.getRepository(
                rel.inverseEntityMetadata.target,
              );

              const children = incomingChildren.map((item) => {
                const child = item as Record<string, unknown>;
                // Explicitly set FK to parent id
                child[fkColumn.propertyName] = id;
                // Remove relation object to prevent TypeORM from overriding FK
                delete child[rel.inverseSidePropertyPath];
                return child;
              });

              await childRepo.save(children);

              // ── 6a. Orphan handling (semantic: only if children key was explicitly sent) ──
              // REST/PATCH semantics:
              // - Omitted children key: keep existing children (no orphan handling)
              // - Explicit children array (even empty): apply orphan handling with defaults
              if (explicitlySetOneToMany.has(rel.propertyName)) {
                // Resolve options with defaults
                const resolvedOptions = new IUpdateOptions(options);

                if (
                  resolvedOptions.hardDeleteOneToMany === true ||
                  resolvedOptions.softDeleteOneToMany === true
                ) {
                  // Load all non-deleted children currently in DB for this parent
                  const existingChildren = await childRepo.find({
                    where: {
                      [fkColumn.propertyName]: id,
                      is_deleted: false,
                    } as FindOptionsWhere<ObjectLiteral>,
                  });

                  // Collect IDs of children present in the incoming payload
                  const incomingIds = new Set(
                    incomingChildren
                      .map(
                        (c) =>
                          (c as Record<string, unknown>).id as
                            string | undefined,
                      )
                      .filter((cId): cId is string => cId !== undefined),
                  );

                  // Orphans = in DB but not in payload
                  const orphanIds = existingChildren
                    .map((c) => String((c as Record<string, unknown>).id))
                    .filter((cId) => !incomingIds.has(cId));

                  if (orphanIds.length > 0) {
                    if (resolvedOptions.hardDeleteOneToMany === true) {
                      await childRepo.delete(orphanIds);
                    } else {
                      // softDeleteOneToMany (default: true)
                      await childRepo.update(orphanIds, {
                        is_deleted: true,
                        deleted_at: new Date(),
                        deleted_reason: 'delete with cascade',
                        deleted_by:
                          typeof currentUser === 'string'
                            ? currentUser
                            : currentUser?.id,
                      });
                    }
                  }
                }
              }
              // If children key was omitted from DTO → no-op (PATCH semantics)
            }
          }

          // ── 7. Sync ManyToMany relations via addAndRemove ──
          if (Object.keys(manyToManyPayload).length > 0) {
            await this._syncManyToManyRelations(txRepo, id, manyToManyPayload);
          }

          // ── 8. Reload entity with updated relations for complete response ──
          const updatedRelationNames = [
            ...Object.keys(oneToManyPayload),
            ...Object.keys(manyToManyPayload),
          ];

          if (updatedRelationNames.length > 0) {
            const reloaded = await txRepo.findOne({
              where: {
                id,
                ...this.softDeleteFilter,
              } as unknown as FindOptionsWhere<TargetRepository>,
              relations: updatedRelationNames,
            });
            return reloaded ?? saved;
          }

          return saved;
        },
      ),
    );
  }

  /**
   * @description
   * Synchronizes ManyToMany junction tables for the given entity.
   * Compares current DB state with the incoming payload and calls `addAndRemove`
   * so that only the diff is written — no duplicate-key errors.
   */
  private async _syncManyToManyRelations(
    repo: Repository<TargetRepository>,
    entityId: string | number,
    payload: Record<string, Array<{ id: string }>>,
  ): Promise<void> {
    const metadata = repo.metadata;

    const syncOne = async (
      relationName: string,
      newItems: Array<{ id: string }>,
    ): Promise<void> => {
      const relationMeta = metadata.relations.find(
        (r) => r.propertyName === relationName,
      );
      if (!relationMeta) return;

      const inverseEntity = relationMeta.inverseEntityMetadata;
      const hasSoftDelete = inverseEntity.columns.some(
        (c) => c.propertyName === 'is_deleted',
      );

      // Load current related items, filtering out soft-deleted records
      const rawItems: Array<{ id: string; is_deleted?: boolean }> = await repo
        .createQueryBuilder()
        .relation(repo.target, relationName)
        .of(entityId)
        .loadMany();

      const currentIds = hasSoftDelete
        ? rawItems.filter((item) => item.is_deleted !== true).map((i) => i.id)
        : rawItems.map((i) => i.id);

      const newIds = newItems.map((i) => i.id).filter(Boolean);

      const toAdd = newIds.filter((nid) => !currentIds.includes(nid));
      const toRemove = currentIds.filter((cid) => !newIds.includes(cid));

      if (toAdd.length > 0 || toRemove.length > 0) {
        await repo
          .createQueryBuilder()
          .relation(repo.target, relationName)
          .of(entityId)
          .addAndRemove(toAdd, toRemove);
      }
    };

    await Promise.all(
      Object.entries(payload).map(([relName, items]) =>
        syncOne(relName, items),
      ),
    );
  }

  /**
   * @description Creates multiple entities in bulk.
   * @param dataArray - Array of DTOs containing data for creating new entities.
   * @param currentUser - Optional user session for audit tracking.
   * @returns A Promise of an array of the created entities.
   */
  async createBulk(
    dataArray: CreateType[],
    currentUser?: IUserSession | string,
  ): Promise<TargetRepository[]> {
    if (dataArray.length === 0) {
      return [];
    }
    return this.executeDbOperation(() =>
      this._createBulkEntities(dataArray, currentUser),
    );
  }

  /**
   * @description Updates multiple entities in bulk.
   * @param updates - Array of objects containing id and data to update.
   * @param currentUser - Optional user session for audit tracking.
   * @returns A Promise of an array of the updated entities.
   */
  async updateBulk(
    updates: UpdateType[],
    filter: Record<string, unknown>,
    currentUser?: IUserSession | string,
    options?: { skipDelete?: boolean },
  ): Promise<TargetRepository[]> {
    if (updates.length === 0) {
      return [];
    }
    return this.executeDbOperation(() =>
      this._updateBulkEntities(updates, filter, currentUser, options),
    );
  }

  // async updateBulkTransaction(
  //     queryRunner: QueryRunner,
  //     entity: unknown,
  //     updates: UpdateType[],
  //     filter: Record<string, unknown>,
  //     currentUser?: IUserSession | string,
  // ): Promise<unknown[]> {
  //     if (updates.length === 0) {
  //         return [];
  //     }
  //     return this.executeDbOperation(() =>
  //         this._updateBulkEntities(updates, filter, currentUser),
  //     );
  // }

  /**
   * @description Deletes an entity by its ID.
   * @param id - The ID of the entity to delete.
   * @param softDelete - If true (default), performs a soft delete. Otherwise, a hard delete.
   * @throws {NotFoundException} If no entity with the given ID is found.
   */
  async delete(
    id: string | number,
    softDelete = true,
    currentUser?: IUserSession | string,
  ): Promise<void> {
    const result = await this.executeDbOperation(() =>
      this._deleteEntity(id, softDelete, currentUser),
    );
    if (result.affected === 0) {
      throw new NotFoundException(
        `${this.tableName} with ID '${id}' not found.`,
      );
    }
  }

  /**
   * Bulk delete is set-based and idempotent by design: it reports how many rows it
   * actually affected instead of throwing when zero match. "Zero matched" is a normal
   * outcome (ids already deleted by a concurrent/prior call, partial-match batches),
   * not an error — the desired end-state (those ids are gone) still holds. Any endpoint
   * that needs strict "all ids must exist" semantics enforces that at its own layer
   * before calling here (see PresetDoctorsService.softDeleteBulk).
   */
  async deleteBulk(
    ids: string[],
    softDelete = true,
    currentUser?: IUserSession | string,
  ): Promise<DeleteBulkResponseDTO> {
    if (ids.length === 0) {
      return { deleted_count: 0, soft_delete: softDelete };
    }

    const result = await this.executeDbOperation(() =>
      this._deleteBulkEntities(ids, softDelete, currentUser),
    );

    return { deleted_count: result.affected ?? 0, soft_delete: softDelete };
  }
}

/**
 * Defines the configuration options specifically for the logger.
 */
export interface LoggerOptions {
  logger: ILogger;
  serviceName?: string;
  serviceVersion?: string;
}

/**
 * Defines the complete set of optional configurations for the BaseServiceOperations class.
 * This allows for easy future extension (e.g., adding caching options) without breaking changes.
 */
export interface BaseServiceOptions {
  logging?: LoggerOptions;
  // config?: ConfigService;
  // Example for the future:
  // caching?: CachingOptions;
}

/**
 * Controls how orphaned OneToMany children are handled during an update.
 *
 * Orphans are children that exist in the database for the given parent FK
 * but are NOT present in the incoming DTO array.
 *
 * **Semantic Rules (REST/PATCH Convention)**:
 * - **Omitted children key**: Keep existing children untouched (partial update)
 * - **Empty array (children: [])**: Delete all children (explicit intention)
 * - **Array with items**: Update to match set; orphans handled per strategy
 *
 * Priority: `hardDeleteOneToMany` beats `softDeleteOneToMany` when both are true.
 */
export class IUpdateOptions {
  /**
   * Permanently DELETE orphaned child rows from the database.
   * @default false
   */
  hardDeleteOneToMany?: boolean = false;

  /**
   * Soft-delete orphaned child rows:
   * `is_deleted = true`, `deleted_at = now()`, `deleted_reason = 'delete with cascade'`.
   *
   * **Recommended for**:
   * - Children with business value (audit trails, order items)
   * - Children referenced by other tables (foreign keys)
   * - Data needed for reporting & compliance
   *
   * @default true
   */
  softDeleteOneToMany?: boolean = true;

  constructor(partial?: Partial<IUpdateOptions>) {
    if (partial) {
      Object.assign(this, partial);
    }
  }
}
