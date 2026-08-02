import fs from 'fs';
import path from 'path';

import { Injectable } from '@nestjs/common';

import { PrintTemplateRenderParams } from '../dto/render-print-template.dto';

// `nest start` (ts-node) and `node dist/apps/report-bc/main.js` (webpack, no
// asset copy step) are both launched via an npm script from the repo root, so
// process.cwd() is a stable anchor in both dev and prod — unlike __dirname,
// which points into dist/ in prod where this asset was never bundled. Same
// reasoning as InvoicePrintService's TEMPLATE_PATH.
const PAGINATOR_ASSET_PATH = path.join(
  process.cwd(),
  'apps/report-bc/src/modules/print-template/assets/paginator.inline.js',
);

/**
 * Turns a `template_engine = 'banded'` template's `html_content` (which
 * declares `<template data-band="...">` blocks — see
 * reviews/print-template-pagination-2026-07-29.md §3.2) into a self-contained
 * document ready for Gotenberg: inject the render data as `window.__RP_DATA__`
 * and append the in-page paginator script.
 *
 * All actual band parsing and pagination happens client-side, inside
 * Chromium, when the injected script runs — this service does no HTML
 * parsing of its own, it only assembles the two pieces the paginator needs.
 */
@Injectable()
export class BandedRenderService {
  private readonly paginatorScript: string;

  constructor() {
    this.paginatorScript = fs.readFileSync(PAGINATOR_ASSET_PATH, 'utf-8');
  }

  /** `waitForExpression` Gotenberg must be given for a banded render — the
   * paginator sets this once every page has been laid out and fonts are
   * confirmed decoded (see the asset's file header for why font-readiness
   * has to gate every height measurement, not just the final snapshot). */
  static readonly WAIT_FOR_EXPRESSION =
    "window.__PAGINATION_DONE === true && document.fonts.status === 'loaded'";

  /**
   * `customPaginatorScript` is one template's own `js_content` (see
   * `PrintTemplate.js_bucket`) — when present (non-empty), it runs instead
   * of the shared `paginator.inline.js`, for a document whose page-break
   * rules genuinely differ from the default (extra bands, different
   * continuation logic, etc.). Falls back to the shared script whenever a
   * template has no override, which is every template today.
   */
  render(
    htmlContent: string,
    params: PrintTemplateRenderParams,
    customPaginatorScript?: string | null,
  ): string {
    // A `</script>` inside any string value of `params` would otherwise
    // close this tag early and let the rest of the JSON parse as raw HTML.
    const safeJson = JSON.stringify(params ?? {}).replace(
      /<\/script/gi,
      '<\\/script',
    );
    const dataScript = `<script>window.__RP_DATA__ = ${safeJson};</script>`;
    const paginatorSource =
      customPaginatorScript && customPaginatorScript.trim()
        ? customPaginatorScript
        : this.paginatorScript;
    const paginatorScript = `<script>${paginatorSource}</script>`;
    const injected = `${dataScript}\n${paginatorScript}`;

    return htmlContent.includes('</body>')
      ? htmlContent.replace('</body>', `${injected}\n</body>`)
      : `${htmlContent}\n${injected}`;
  }
}
