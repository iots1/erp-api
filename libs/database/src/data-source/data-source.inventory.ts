import { createDataSource } from './create-data-source';

/** Inventory BC database (core stock & lot). */
export default createDataSource(
  'INVENTORY_DB',
  'inventory-bc',
  'erp_inventory',
);
