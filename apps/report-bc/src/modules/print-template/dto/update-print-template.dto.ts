import { PartialType } from '@nestjs/swagger';

import { CreatePrintTemplateDTO } from './create-print-template.dto';

export class UpdatePrintTemplateDTO extends PartialType(
  CreatePrintTemplateDTO,
) {}
