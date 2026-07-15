export class NumericTransformer {
  to(data: number | null | undefined): number | null {
    if (data === null || data === undefined) return null;
    return data;
  }

  from(data: string | number | null | undefined): number | null {
    if (data === null || data === undefined) return null;

    const parsed = typeof data === 'number' ? data : parseFloat(data);
    return Number.isNaN(parsed) ? null : parsed;
  }

  /**
   * Static transform function for use with class-transformer @Transform decorator in DTOs.
   * Accepts string | number | null from client and coerces to number | null.
   *
   * @example
   * @Transform(NumericTransformer.toDTO)
   * @IsNumber()
   * price: number | null;
   */
  static toDTO(this: void, { value }: { value: unknown }): number | null {
    if (value == null) return null;
    const parsed =
      typeof value === 'string' ? parseFloat(value) : Number(value);
    return isNaN(parsed) ? null : parsed;
  }
}
