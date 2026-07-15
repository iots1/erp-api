/**
 * Per-Bounded-Context databases in the ERP platform. Each BC owns its own
 * physical PostgreSQL database (separated from the start). The enum value is both
 * the default database name and the TypeORM connection name used in
 * `@Entity({ database })`, `TypeOrmModule.forFeature([...], database)` and
 * `@InjectRepository(Entity, database)`.
 */
export enum ErpDatabases {
  IAM = 'erp_iam',
  INVENTORY = 'erp_inventory',
  SUPPLIER = 'erp_supplier',
  SALES = 'erp_sales',
  FINANCE = 'erp_finance',
  REPORT = 'erp_report',
  STORAGE = 'erp_storage',
}

/**
 * Maps each database to the env-var prefix carrying its connection settings,
 * e.g. SALES → `SALES_DB_HOST`, `SALES_DB_PORT`, `SALES_DB_NAME`, ...
 */
export const ERP_DB_ENV_PREFIX: Record<ErpDatabases, string> = {
  [ErpDatabases.IAM]: 'IAM_DB',
  [ErpDatabases.INVENTORY]: 'INVENTORY_DB',
  [ErpDatabases.SUPPLIER]: 'SUPPLIER_DB',
  [ErpDatabases.SALES]: 'SALES_DB',
  [ErpDatabases.FINANCE]: 'FINANCE_DB',
  [ErpDatabases.REPORT]: 'REPORT_DB',
  [ErpDatabases.STORAGE]: 'STORAGE_DB',
};
