import { PartialType } from '@nestjs/swagger';

import { CreateWarehouseDTO } from './create-warehouse.dto';

export class UpdateWarehouseDTO extends PartialType(CreateWarehouseDTO) {}
