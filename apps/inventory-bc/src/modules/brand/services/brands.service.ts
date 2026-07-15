import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { BaseServiceOperations } from '@lib/common/utils/base-operations/base-service-operations.util';
import { ConfigService } from '@lib/config';

import { CreateBrandDTO } from '../dto/create-brand.dto';
import { UpdateBrandDTO } from '../dto/update-brand.dto';
import { Brand } from '../entities/brand.entity';

@Injectable()
export class BrandsService extends BaseServiceOperations<
  Brand,
  CreateBrandDTO,
  UpdateBrandDTO
> {
  protected readonly allowedRelations: string[] = [];

  constructor(
    protected readonly logger: LogsService,
    configService: ConfigService,
    @InjectRepository(Brand, ErpDatabases.INVENTORY)
    brandRepository: Repository<Brand>,
  ) {
    super(brandRepository, {
      logging: {
        logger: logger,
        serviceName: configService.get('INVENTORY_PREFIX_NAME'),
        serviceVersion: configService.get('INVENTORY_PREFIX_VERSION'),
      },
    });
  }
}
