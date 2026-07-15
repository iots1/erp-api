import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { BaseServiceOperations } from '@lib/common/utils/base-operations/base-service-operations.util';
import { ConfigService } from '@lib/config';

import { CreateSupplierDTO } from '../dto/create-supplier.dto';
import { UpdateSupplierDTO } from '../dto/update-supplier.dto';
import { Supplier } from '../entities/supplier.entity';

@Injectable()
export class SuppliersService extends BaseServiceOperations<
  Supplier,
  CreateSupplierDTO,
  UpdateSupplierDTO
> {
  protected readonly allowedRelations: string[] = [];

  constructor(
    protected readonly logger: LogsService,
    configService: ConfigService,
    @InjectRepository(Supplier, ErpDatabases.SUPPLIER)
    supplierRepository: Repository<Supplier>,
  ) {
    super(supplierRepository, {
      logging: {
        logger: logger,
        serviceName: configService.get('SUPPLIER_PREFIX_NAME'),
        serviceVersion: configService.get('SUPPLIER_PREFIX_VERSION'),
      },
    });
  }
}
