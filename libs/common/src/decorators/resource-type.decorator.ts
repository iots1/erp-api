import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';

export const RESOURCE_TYPE_KEY = 'resourceType';

/**
 * Sets the JSON:API resource type for a controller, used by TransformInterceptor
 * to wrap responses. Also documents the type as an OpenAPI extension.
 *
 * @example
 * @ResourceType('trainers')
 * export class TrainersController {}
 */
export const ResourceType = (type: string): MethodDecorator & ClassDecorator =>
  applyDecorators(
    SetMetadata(RESOURCE_TYPE_KEY, type),
    ApiExtension('x-resource-type', { resourceType: type }),
  );
