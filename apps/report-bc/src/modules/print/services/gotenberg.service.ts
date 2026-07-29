import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { LogsService } from '@lib/common/modules/log/logs.service';
import { ConfigService } from '@lib/config';

/**
 * Thin HTTP client for Gotenberg's Chromium HTML → PDF route. Owned entirely
 * by report-bc — no other BC calls Gotenberg directly (see print.module.ts).
 */
@Injectable()
export class GotenbergService {
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LogsService,
  ) {
    this.logger.setContext(GotenbergService.name);
    this.baseUrl = this.configService.get<string>(
      'GOTENBERG_URL',
      'http://localhost:3009',
    );
  }

  /**
   * Converts a self-contained HTML document to a PDF buffer via Gotenberg's
   * `/forms/chromium/convert/html` route. Gotenberg requires the main file be
   * named exactly `index.html`. `paperSize` defaults to A4 portrait — the
   * dimensions every existing caller (invoice mock print) relies on.
   */
  async convertHtmlToPdf(
    html: string,
    paperSize: { widthIn: number; heightIn: number } = {
      widthIn: 8.27,
      heightIn: 11.7,
    },
  ): Promise<Buffer> {
    const form = new FormData();
    form.append('files', new Blob([html], { type: 'text/html' }), 'index.html');
    form.append('paperWidth', String(paperSize.widthIn));
    form.append('paperHeight', String(paperSize.heightIn));
    form.append('marginTop', '0.4');
    form.append('marginBottom', '0.4');
    form.append('marginLeft', '0.4');
    form.append('marginRight', '0.4');
    form.append('printBackground', 'true');
    // Templates are authored/previewed as regular (screen) HTML — without this,
    // Chromium's PDF export defaults to `print` media, which can silently
    // apply different rules than what the admin's live preview showed.
    form.append('emulatedMediaType', 'screen');
    // Gotenberg 8 skips waiting for network-idle by default (perf trade-off),
    // so a template's own async resources (webfonts, remote scripts/images)
    // can still be mid-flight when Chromium snapshots the page — producing a
    // PDF that doesn't match what fully loaded in a browser. Wait for both
    // network idle and font decoding to finish before printing.
    form.append('skipNetworkIdleEvent', 'false');
    form.append('waitForExpression', "document.fonts.status === 'loaded'");

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/forms/chromium/convert/html`, {
        method: 'POST',
        body: form,
      });
    } catch (error) {
      this.logger.error(
        'Failed to reach Gotenberg',
        error instanceof Error ? error : undefined,
        { baseUrl: this.baseUrl },
      );
      throw new ServiceUnavailableException(
        'Cannot connect to the PDF rendering service.',
      );
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logger.error(`Gotenberg returned ${response.status}`, undefined, {
        status: response.status,
        detail: detail.slice(0, 500),
      });
      throw new ServiceUnavailableException(
        'The PDF rendering service failed to generate the document.',
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
