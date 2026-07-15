import { BadRequestException } from '@nestjs/common';

import { IValidationError } from './validation.helper';

export class ValidationException extends BadRequestException {
  public validationErrors: IValidationError[];

  constructor(validationErrors: IValidationError[]) {
    super({ message: 'Validation failed', errors: validationErrors });
    this.validationErrors = validationErrors;
  }
}
