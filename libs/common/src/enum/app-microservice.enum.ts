/**
 * Registry of microservice endpoints in the ERP platform.
 *
 * Each entry's `name` is the DI token used to inject a ClientProxy. The active
 * transport is chosen platform-wide by the `TRANSPORT` env key (default `rmq`,
 * fallback `tcp`) — see `resolveTransport()` in `microservice-transport.util`.
 *
 * - `queue`               → RabbitMQ queue bound to the service (TRANSPORT=rmq).
 * - `hostEnv` / `portEnv` → TCP host/port env keys (TRANSPORT=tcp fallback).
 */
export const AppMicroservice = {
  Auth: {
    name: 'AUTH_SERVICE',
    queue: 'erp_auth_queue',
    hostEnv: 'AUTH_MODULE_MICROSERVICE_HOST',
    portEnv: 'AUTH_MODULE_MICROSERVICE_PORT',
  },
  Iam: {
    name: 'IAM_SERVICE',
    queue: 'erp_iam_queue',
    hostEnv: 'IAM_MODULE_MICROSERVICE_HOST',
    portEnv: 'IAM_MODULE_MICROSERVICE_PORT',
  },
  Inventory: {
    name: 'INVENTORY_SERVICE',
    queue: 'erp_inventory_queue',
    hostEnv: 'INVENTORY_BC_MODULE_MICROSERVICE_HOST',
    portEnv: 'INVENTORY_BC_MODULE_MICROSERVICE_PORT',
  },
  Supplier: {
    name: 'SUPPLIER_SERVICE',
    queue: 'erp_supplier_queue',
    hostEnv: 'SUPPLIER_BC_MODULE_MICROSERVICE_HOST',
    portEnv: 'SUPPLIER_BC_MODULE_MICROSERVICE_PORT',
    cmd: {
      SupplierResources: {
        GetSupplierById: 'supplierBc.supplier.getById',
        GetSupplierPaginated: 'supplierBc.supplier.getPaginated',
      },
    },
  },
  Sales: {
    name: 'SALES_SERVICE',
    queue: 'erp_sales_queue',
    hostEnv: 'SALES_BC_MODULE_MICROSERVICE_HOST',
    portEnv: 'SALES_BC_MODULE_MICROSERVICE_PORT',
  },
  Finance: {
    name: 'FINANCE_SERVICE',
    queue: 'erp_finance_queue',
    hostEnv: 'FINANCE_BC_MODULE_MICROSERVICE_HOST',
    portEnv: 'FINANCE_BC_MODULE_MICROSERVICE_PORT',
  },
  Report: {
    name: 'REPORT_SERVICE',
    queue: 'erp_report_queue',
    hostEnv: 'REPORT_BC_MODULE_MICROSERVICE_HOST',
    portEnv: 'REPORT_BC_MODULE_MICROSERVICE_PORT',
  },
  Storage: {
    name: 'STORAGE_SERVICE',
    queue: 'erp_storage_queue',
    hostEnv: 'STORAGE_MODULE_MICROSERVICE_HOST',
    portEnv: 'STORAGE_MODULE_MICROSERVICE_PORT',
    cmd: {
      Upload: 'storage.uploadFile',
      UploadWithMeta: 'storage.uploadFileWithMeta',
      Remove: 'storage.deleteFile',
      GetPath: 'storage.getPath',
      GenerateSignedUrls: 'storage.generateSignedUrls',
    },
  },
} as const;

export type AppMicroserviceKey = keyof typeof AppMicroservice;

/** DI token for the shared ioredis client registered by `RedisModule` (`@lib/common`). */
export const RedisService = {
  name: 'REDIS_CLIENT',
} as const;
