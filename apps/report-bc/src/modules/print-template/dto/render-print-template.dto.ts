import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsObject, IsOptional } from 'class-validator';

/** A `type: 'array'` parameter's value — one row per item, keyed by that
 * parameter's `item_schema` field keys (becomes `{{row.<field>}}` in a
 * `<template data-repeat="key">` band). */
type PrintTemplateArrayParamValue = Array<Record<string, unknown>>;

/** Shared by both engines: `'simple'` only ever reads flat scalars out of
 * this (via `PrintTemplatesService.substituteParameters()`); `'banded'`
 * hands the whole object to the client-side paginator as-is (nested paths
 * like `seller.name` and arrays for `data-repeat` bands included), so no
 * server-side shape restriction beyond "JSON-safe" is imposed here. */
export type PrintTemplateRenderParams = Record<
  string,
  string | number | boolean | null | PrintTemplateArrayParamValue
>;

export class RenderPrintTemplateDTO {
  @IsOptional()
  @IsObject()
  @ApiPropertyOptional({
    description:
      'ค่าตัวแปรสำหรับแทนที่ {{key}} ใน html_content — key ที่ไม่ได้ส่งมาจะใช้ default_value ของ parameter นั้นแทน ' +
      "parameter ที่ type='array' (ใช้กับ band แบบ banded engine) ส่งเป็น array ของ object ได้",
    example: {
      customer_name: 'บริษัท เอบีซี จำกัด',
      invoice_no: 'INV-2026-0099',
      items: [{ description: 'สินค้า A', quantity: '1', total: '100.00' }],
    },
  })
  params: PrintTemplateRenderParams;
}
