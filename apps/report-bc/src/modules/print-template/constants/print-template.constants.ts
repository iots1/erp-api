/**
 * Real domain constants for print templates — paper sizes/orientations
 * accepted on create/update, and the physical dimensions (inches) Gotenberg's
 * `paperWidth`/`paperHeight` form fields expect. Swagger/description strings
 * belong in `print-template.swagger.ts`, not here.
 */

export const PRINT_TEMPLATE_PAPER_SIZES = [
  'A4',
  'A5',
  'Letter',
  'Legal',
] as const;
export type PrintTemplatePaperSize =
  (typeof PRINT_TEMPLATE_PAPER_SIZES)[number];

export const PRINT_TEMPLATE_ORIENTATIONS = ['portrait', 'landscape'] as const;
export type PrintTemplateOrientation =
  (typeof PRINT_TEMPLATE_ORIENTATIONS)[number];

export const PRINT_TEMPLATE_ENGINES = ['simple', 'banded'] as const;

export const PRINT_TEMPLATE_MEDIA_TYPES = ['print', 'screen'] as const;

export const PRINT_TEMPLATE_PARAMETER_TYPES = [
  'string',
  'number',
  'date',
  'boolean',
  'array',
] as const;

/** Portrait dimensions in inches — swapped for landscape by the caller. */
export const PRINT_TEMPLATE_PAPER_DIMENSIONS_IN: Record<
  PrintTemplatePaperSize,
  { width: number; height: number }
> = {
  A4: { width: 8.27, height: 11.69 },
  A5: { width: 5.83, height: 8.27 },
  Letter: { width: 8.5, height: 11 },
  Legal: { width: 8.5, height: 14 },
};
