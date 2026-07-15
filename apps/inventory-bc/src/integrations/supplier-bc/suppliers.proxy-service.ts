import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { MicroserviceClientService } from '@lib/common';
import { AppMicroservice } from '@lib/common/enum/app-microservice.enum';
import { LogsService } from '@lib/common/modules/log/logs.service';

/**
 * Minimal cross-BC read shape — deliberately NOT the full supplier-bc `Supplier`
 * entity, since consumer BCs must never import another BC's entity/repository
 * (database-per-context rule). Only the fields `ProductsService` needs to
 * validate/display a `supplier_id` reference.
 */
export interface SupplierLookupResult {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
}

/**
 * Proxy between inventory-bc and supplier-bc for resolving `products.supplier_id`
 * (UUID, no cross-database FK) via TCP. `sendWithContext` never throws — a
 * `null` result means "not found or supplier-bc unreachable"; the caller decides.
 */
@Injectable()
export class SuppliersProxyService {
  constructor(
    private readonly logger: LogsService,
    private readonly microserviceClient: MicroserviceClientService,
    @Inject(AppMicroservice.Supplier.name)
    private readonly supplierClient: ClientProxy,
  ) {}

  async getSupplierById(id: string): Promise<SupplierLookupResult | null> {
    return this.microserviceClient.sendWithContext<
      SupplierLookupResult,
      { id: string }
    >(
      this.logger,
      this.supplierClient,
      { cmd: AppMicroservice.Supplier.cmd.SupplierResources.GetSupplierById },
      { id },
      null,
    );
  }
}
