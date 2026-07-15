import { PartialType } from '@nestjs/swagger';

import { CreateUomDTO } from './create-uom.dto';

export class UpdateUomDTO extends PartialType(CreateUomDTO) {}
