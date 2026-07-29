import { PartialType } from '@nestjs/swagger';

import { CreateDocumentTypeDTO } from './create-document-type.dto';

export class UpdateDocumentTypeDTO extends PartialType(CreateDocumentTypeDTO) {}
