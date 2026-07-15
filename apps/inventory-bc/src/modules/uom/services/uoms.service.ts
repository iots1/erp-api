import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { BaseServiceOperations } from '@lib/common/utils/base-operations/base-service-operations.util';
import { ConfigService } from '@lib/config';

import { CreateUomDTO } from '../dto/create-uom.dto';
import { UpdateUomDTO } from '../dto/update-uom.dto';
import { Uom } from '../entities/uom.entity';

@Injectable()
export class UomsService extends BaseServiceOperations<
  Uom,
  CreateUomDTO,
  UpdateUomDTO
> {
  protected readonly allowedRelations: string[] = [];

  constructor(
    protected readonly logger: LogsService,
    configService: ConfigService,
    @InjectRepository(Uom, ErpDatabases.INVENTORY)
    uomRepository: Repository<Uom>,
  ) {
    super(uomRepository, {
      logging: {
        logger: logger,
        serviceName: configService.get('INVENTORY_PREFIX_NAME'),
        serviceVersion: configService.get('INVENTORY_PREFIX_VERSION'),
      },
    });
  }
}
