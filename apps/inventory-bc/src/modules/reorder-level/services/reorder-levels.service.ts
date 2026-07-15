import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { IResponsePaginatedService } from '@lib/common';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import { QueryParamsDTO } from '@lib/common/dto/query-params.dto';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { BaseServiceOperations } from '@lib/common/utils/base-operations/base-service-operations.util';
import { ConfigService } from '@lib/config';

import { CreateReorderLevelDTO } from '../dto/create-reorder-level.dto';
import { UpdateReorderLevelDTO } from '../dto/update-reorder-level.dto';
import { ReorderLevel } from '../entities/reorder-level.entity';

@Injectable()
export class ReorderLevelsService extends BaseServiceOperations<
  ReorderLevel,
  CreateReorderLevelDTO,
  UpdateReorderLevelDTO
> {
  protected readonly allowedRelations: string[] = [];

  constructor(
    protected readonly logger: LogsService,
    configService: ConfigService,
    @InjectRepository(ReorderLevel, ErpDatabases.INVENTORY)
    reorderLevelRepository: Repository<ReorderLevel>,
  ) {
    super(reorderLevelRepository, {
      logging: {
        logger: logger,
        serviceName: configService.get('INVENTORY_PREFIX_NAME'),
        serviceVersion: configService.get('INVENTORY_PREFIX_VERSION'),
      },
    });
  }

  findPaginatedByProductId(
    productId: string,
    query: QueryParamsDTO,
  ): Promise<IResponsePaginatedService<ReorderLevel[]>> {
    return super.findPaginated({
      ...query,
      filter: ([] as string[])
        .concat(query.filter ?? [])
        .concat(`product_id||$eq||${productId}`),
    });
  }
}
