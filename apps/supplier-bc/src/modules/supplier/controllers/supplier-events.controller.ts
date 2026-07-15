import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import type { IResponsePaginatedService } from '@lib/common';
import { AppMicroservice } from '@lib/common/enum/app-microservice.enum';
import { QueryParamsDTO } from '@lib/common/dto/query-params.dto';
import type { IMicroservicePayload } from '@lib/common/interfaces';
import { LogsService } from '@lib/common/modules/log/logs.service';

import { Supplier } from '../entities/supplier.entity';
import { SuppliersService } from '../services/suppliers.service';

/**
 * TCP-facing handlers so other BCs (e.g. inventory-bc's `products.supplier_id`)
 * can resolve a supplier by UUID without a cross-database FK. Exceptions thrown
 * by the service bubble to the globally-registered `RpcExceptionsFilter`, which
 * formats them into the standard RPC error envelope — no manual try/catch needed.
 */
@Controller()
export class SupplierEventsController {
  constructor(
    private readonly logger: LogsService,
    private readonly suppliersService: SuppliersService,
  ) {}

  @MessagePattern({
    cmd: AppMicroservice.Supplier.cmd.SupplierResources.GetSupplierById,
  })
  async handleGetSupplierById(
    @Payload() data: IMicroservicePayload<{ id: string }>,
  ): Promise<Supplier> {
    this.logger.setContextFromPayload(data._context);
    this.logger.info({
      message: `Get supplier by id: ${data.payload.id}`,
      context: { action: 'GET_SUPPLIER_BY_ID' },
    });
    return this.suppliersService.findById(data.payload.id);
  }

  @MessagePattern({
    cmd: AppMicroservice.Supplier.cmd.SupplierResources.GetSupplierPaginated,
  })
  async handleGetSupplierPaginated(
    @Payload() data: IMicroservicePayload<{ query: QueryParamsDTO }>,
  ): Promise<IResponsePaginatedService<Supplier[]>> {
    this.logger.setContextFromPayload(data._context);
    this.logger.info({
      message: 'Get suppliers paginated',
      context: { action: 'GET_SUPPLIER_PAGINATED' },
    });
    return this.suppliersService.findPaginated(data.payload.query);
  }
}
