import { IntersectionType } from '@nestjs/swagger';

import { BaseResponseDTO } from '@lib/common/dto/base-response.dto';

import { CreateDocumentTypeDTO } from './create-document-type.dto';

export class DocumentTypeResponseDTO extends IntersectionType(
  CreateDocumentTypeDTO,
  BaseResponseDTO,
) {}
