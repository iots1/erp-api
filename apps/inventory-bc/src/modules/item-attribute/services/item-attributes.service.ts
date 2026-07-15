import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { BaseServiceOperations } from '@lib/common/utils/base-operations/base-service-operations.util';
import { ConfigService } from '@lib/config';

import { CreateItemAttributeDTO } from '../dto/create-item-attribute.dto';
import { UpdateItemAttributeDTO } from '../dto/update-item-attribute.dto';
import { ItemAttribute } from '../entities/item-attribute.entity';

@Injectable()
export class ItemAttributesService extends BaseServiceOperations<
  ItemAttribute,
  CreateItemAttributeDTO,
  UpdateItemAttributeDTO
> {
  protected readonly allowedRelations: string[] = [];

  constructor(
    protected readonly logger: LogsService,
    configService: ConfigService,
    @InjectRepository(ItemAttribute, ErpDatabases.INVENTORY)
    itemAttributeRepository: Repository<ItemAttribute>,
  ) {
    super(itemAttributeRepository, {
      logging: {
        logger: logger,
        serviceName: configService.get('INVENTORY_PREFIX_NAME'),
        serviceVersion: configService.get('INVENTORY_PREFIX_VERSION'),
      },
    });
  }
}
