import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';

import { isUUID } from 'class-validator';

import { InvalidParameterException } from '@lib/common/utils/http-exception/invalid-parameter.exception';

/**
 * Validates route params (e.g. `:id`) are well-formed UUIDs before they
 * reach controllers/services, rejecting malformed input with 400002
 * instead of letting it fall through to a raw DB error (PG 22P02) or,
 * worse, an unvalidated string being used in a query.
 */
@Injectable()
export class ParseUuidParamPipe implements PipeTransform<string, string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    const field = metadata.data ?? 'id';

    if (typeof value !== 'string' || !isUUID(value)) {
      throw new InvalidParameterException([
        { field, message: `${field} must be a valid UUID` },
      ]);
    }

    return value;
  }
}
