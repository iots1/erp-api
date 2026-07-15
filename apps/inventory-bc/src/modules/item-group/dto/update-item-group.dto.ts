import { PartialType } from '@nestjs/swagger';

import { CreateItemGroupDTO } from './create-item-group.dto';

export class UpdateItemGroupDTO extends PartialType(CreateItemGroupDTO) {}
