import { DeepPartial, ObjectLiteral } from 'typeorm';

import { QueryParamsDTO } from '@lib/common/dto/query-params.dto';
import { IUserSession } from '@lib/common/interfaces/auth.interface';
import { IResponsePaginatedService } from '@lib/common/interfaces/response/response-service.interface';
import { ITimestamp } from '@lib/common/interfaces/timestamp.interface';

import {
  BaseServiceOperations,
  IUpdateOptions,
} from './base-service-operations.util';

/**
 * Provides a generic, reusable base for CRUD controllers.
 *
 * Its primary responsibility is to delegate incoming requests to a corresponding
 * service, keeping the controller layer lightweight and focused on routing. This class
 * returns raw data directly, relying on NestJS Interceptors and Exception Filters
 * for response serialization and error handling.
 *
 * @template EntityType The TypeORM entity being exposed as a resource.
 * @template CreateDTO The Data Transfer Object for creating the resource.
 * @template UpdateDTO The Data Transfer Object for updating the resource.
 * @template ServiceType The corresponding service that extends BaseServiceOperations.
 */
export abstract class BaseControllerOperations<
  EntityType extends ObjectLiteral & ITimestamp,
  CreateDTO extends DeepPartial<EntityType>,
  UpdateDTO extends DeepPartial<EntityType>,
  ServiceType extends BaseServiceOperations<EntityType, CreateDTO, UpdateDTO>,
> {
  /**
   * @param service The injected service instance that contains the business logic.
   */
  constructor(protected readonly service: ServiceType) {}

  /**
   * Creates a new resource.
   * @param createDTO The Data Transfer Object for creating the resource.
   * @returns A promise resolving to the newly created resource.
   */
  create(
    createDTO: CreateDTO,
    currentUser?: IUserSession,
  ): Promise<EntityType> {
    return this.service.create(createDTO, currentUser);
  }

  /**
   * Retrieves a list of all resources.
   * @returns A promise resolving to an array of resources.
   */
  findAll(query: QueryParamsDTO): Promise<EntityType[]> {
    return this.service.findAll(query);
  }

  /**
   * Retrieves a paginated list of resources.
   * @param query The DTO containing pagination, filtering, and sorting parameters.
   * @returns A promise resolving to an object with the data array and pagination metadata.
   */
  findPaginated(
    query: QueryParamsDTO,
  ): Promise<IResponsePaginatedService<EntityType[]>> {
    return this.service.findPaginated(query);
  }

  /**
   * Retrieves a single resource by its ID.
   * @param id The unique identifier of the resource.
   * @returns A promise resolving to the found resource.
   * @throws {NotFoundException} If the resource with the given ID does not exist.
   */
  findOne(id: string | number): Promise<EntityType> {
    return this.service.findById(id);
  }

  /**
   * Retrieves a single resource by query parameters (filter, relations, etc.).
   * @param query The DTO containing filtering and relation parameters.
   * @returns A promise resolving to the found resource.
   * @throws {NotFoundException} If no resource matches the given query.
   */
  findOneOrQuery(query: QueryParamsDTO): Promise<EntityType | null> {
    return this.service.findOneOrQuery(query);
  }

  /**
   * Updates an existing resource by its ID.
   * @param id The unique identifier of the resource to update.
   * @param updateDTO The Data Transfer Object for updating the resource.
   * @param currentUser Optional user session for audit tracking.
   * @param options Optional update options for handling orphaned OneToMany children.
   * @returns A promise resolving to the updated resource.
   */
  update(
    id: string,
    updateDTO: UpdateDTO,
    currentUser?: IUserSession,
    options?: IUpdateOptions,
  ): Promise<EntityType> {
    return this.service.update(id, updateDTO, currentUser, options);
  }

  /**
   * Creates multiple resources in bulk.
   * @param dataArray Array of Data Transfer Objects for creating new resources.
   * @param currentUser Optional user session for audit tracking.
   * @returns A promise resolving to an array of the newly created resources.
   */
  createBulk(
    dataArray: CreateDTO[],
    currentUser?: IUserSession,
  ): Promise<EntityType[]> {
    return this.service.createBulk(dataArray, currentUser);
  }

  /**
   * Updates multiple resources in bulk.
   * @param updates Array of objects containing id and updateDTO for updating resources.
   * @param currentUser Optional user session for audit tracking.
   * @returns A promise resolving to an array of the updated resources.
   */
  updateBulk(
    updates: UpdateDTO[],
    filter: Record<string, unknown>,
    currentUser?: IUserSession,
  ): Promise<EntityType[]> {
    return this.service.updateBulk(updates, filter, currentUser);
  }

  /**
   * Deletes a resource by its ID.
   * The void return type results in a `204 No Content` HTTP response upon success.
   * @param id The unique identifier of the resource to delete.
   */
  async softDelete(
    id: string | number,
    currentUser?: IUserSession,
  ): Promise<void> {
    await this.service.delete(id, true, currentUser);
  }

  async delete(id: string | number, currentUser?: IUserSession): Promise<void> {
    await this.service.delete(id, false, currentUser);
  }
}
