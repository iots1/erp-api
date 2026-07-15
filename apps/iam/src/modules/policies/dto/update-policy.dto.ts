import { PartialType } from '@nestjs/swagger';

import { CreatePolicyDTO } from './create-policy.dto';

export class UpdatePolicyDTO extends PartialType(CreatePolicyDTO) {}
