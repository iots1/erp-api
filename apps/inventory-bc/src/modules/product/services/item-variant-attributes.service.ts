import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { DeepPartial, Repository } from 'typeorm';

import { IResponsePaginatedService } from '@lib/common';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import { QueryParamsDTO } from '@lib/common/dto/query-params.dto';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { BaseServiceOperations } from '@lib/common/utils/base-operations/base-service-operations.util';
import { ConfigService } from '@lib/config';

import { ItemVariantAttribute } from '../entities/item-variant-attribute.entity';

/**
 * Read-only from the controller's perspective — rows are only ever written by
 * `ProductsService.generateVariants`. `BaseServiceOperations` still needs
 * Create/Update type parameters; `DeepPartial<ItemVariantAttribute>` satisfies
 * them without a dedicated (unused) DTO pair.
 */
@Injectable()
export class ItemVariantAttributesService extends BaseServiceOperations<
  ItemVariantAttribute,
  DeepPartial<ItemVariantAttribute>,
  DeepPartial<ItemVariantAttribute>
> {
  protected readonly allowedRelations: string[] = [];

  constructor(
    protected readonly logger: LogsService,
    configService: ConfigService,
    @InjectRepository(ItemVariantAttribute, ErpDatabases.INVENTORY)
    itemVariantAttributeRepository: Repository<ItemVariantAttribute>,
  ) {
    super(itemVariantAttributeRepository, {
      logging: {
        logger: logger,
        serviceName: configService.get('INVENTORY_PREFIX_NAME'),
        serviceVersion: configService.get('INVENTORY_PREFIX_VERSION'),
      },
    });
  }

  findPaginatedByVariantProductId(
    variantProductId: string,
    query: QueryParamsDTO,
  ): Promise<IResponsePaginatedService<ItemVariantAttribute[]>> {
    return super.findPaginated({
      ...query,
      filter: ([] as string[])
        .concat(query.filter ?? [])
        .concat(`variant_product_id||$eq||${variantProductId}`),
    });
  }
}
