import { createDataSource } from './create-data-source';

/** Report BC database (analytics / CQRS read models). */
export default createDataSource('REPORT_DB', 'report-bc', 'erp_report');
