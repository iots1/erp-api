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
   * named exactly `index.html`.
   */
  async convertHtmlToPdf(html: string): Promise<Buffer> {
    const form = new FormData();
    form.append('files', new Blob([html], { type: 'text/html' }), 'index.html');
    form.append('paperWidth', '8.27'); // A4
    form.append('paperHeight', '11.7');
    form.append('marginTop', '0.4');
    form.append('marginBottom', '0.4');
    form.append('marginLeft', '0.4');
    form.append('marginRight', '0.4');
    form.append('printBackground', 'true');

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
