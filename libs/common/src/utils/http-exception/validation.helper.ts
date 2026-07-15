import { ValidationError } from 'class-validator';

export interface IValidationError {
  field: string;
  messages: string[];
}

/**
 * Recursively flattens class-validator errors (including nested objects) into a
 * flat list of `{ field, messages }` pairs.
 */
export const flattenValidationErrors = (
  errors: ValidationError[],
  parentPath = '',
): IValidationError[] => {
  let allErrors: IValidationError[] = [];

  for (const error of errors) {
    const currentPath = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    if (error.constraints) {
      allErrors.push({
        field: currentPath,
        messages: Object.values(error.constraints),
      });
    }

    if (error.children && error.children.length > 0) {
      allErrors = allErrors.concat(
        flattenValidationErrors(error.children, currentPath),
      );
    }
  }

  return allErrors;
};
