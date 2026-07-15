import { PartialType } from '@nestjs/swagger';

import { CreateSupplierDTO } from './create-supplier.dto';

export class UpdateSupplierDTO extends PartialType(CreateSupplierDTO) {}
