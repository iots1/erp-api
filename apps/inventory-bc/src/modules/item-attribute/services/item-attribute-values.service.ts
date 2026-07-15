import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { IResponsePaginatedService } from '@lib/common';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import { QueryParamsDTO } from '@lib/common/dto/query-params.dto';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { BaseServiceOperations } from '@lib/common/utils/base-operations/base-service-operations.util';
import { ConfigService } from '@lib/config';

import { CreateItemAttributeValueDTO } from '../dto/create-item-attribute-value.dto';
import { UpdateItemAttributeValueDTO } from '../dto/update-item-attribute-value.dto';
import { ItemAttributeValue } from '../entities/item-attribute-value.entity';

@Injectable()
export class ItemAttributeValuesService extends BaseServiceOperations<
  ItemAttributeValue,
  CreateItemAttributeValueDTO,
  UpdateItemAttributeValueDTO
> {
  protected readonly allowedRelations: string[] = [];

  constructor(
    protected readonly logger: LogsService,
    configService: ConfigService,
    @InjectRepository(ItemAttributeValue, ErpDatabases.INVENTORY)
    itemAttributeValueRepository: Repository<ItemAttributeValue>,
  ) {
    super(itemAttributeValueRepository, {
      logging: {
        logger: logger,
        serviceName: configService.get('INVENTORY_PREFIX_NAME'),
        serviceVersion: configService.get('INVENTORY_PREFIX_VERSION'),
      },
    });
  }

  findPaginatedByAttributeId(
    attributeId: string,
    query: QueryParamsDTO,
  ): Promise<IResponsePaginatedService<ItemAttributeValue[]>> {
    return super.findPaginated({
      ...query,
      filter: ([] as string[])
        .concat(query.filter ?? [])
        .concat(`attribute_id||$eq||${attributeId}`),
    });
  }
}
