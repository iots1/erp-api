import { Controller, Get, Redirect } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { Public } from '@lib/common';
import { ConfigService } from '@lib/config';

/** `/views` (no page) sends admins to the dashboard, the natural landing page. */
@ApiExcludeController()
@Controller('views')
export class ViewsIndexController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  @Public()
  @Redirect()
  index(): { url: string } {
    const prefixName =
      this.configService.get<string>('IAM_PREFIX_NAME') ?? 'iam';
    const prefixVersion =
      this.configService.get<string>('IAM_PREFIX_VERSION') ?? 'v1';
    return { url: `/${prefixName}/${prefixVersion}/views/dashboard` };
  }
}
