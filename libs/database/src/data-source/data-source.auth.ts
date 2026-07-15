import { createDataSource } from './create-data-source';

/** Auth BC database (credentials, refresh tokens, login history, blocks, security logs — no user profile data). */
export default createDataSource('AUTH_DB', 'auth', 'erp_auth');
