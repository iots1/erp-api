import { HttpException, HttpStatus } from '@nestjs/common';

import { IErrorObject } from '@lib/common/interfaces/response/error-object.interface';

export class InvalidParameterException extends HttpException {
  constructor(public readonly validationErrors: IErrorObject[]) {
    super('Invalid Parameter Format', HttpStatus.BAD_REQUEST);
  }
}
