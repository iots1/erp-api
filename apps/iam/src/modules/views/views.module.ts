import { Module } from '@nestjs/common';

import { AuditLogsViewController } from './controllers/audit-logs.controller';
import { DashboardViewController } from './controllers/dashboard.controller';
import { PoliciesViewController } from './controllers/policies.controller';
import { RolesViewController } from './controllers/roles.controller';
import { SessionsViewController } from './controllers/sessions.controller';
import { SystemSettingViewController } from './controllers/system-setting.controller';
import { UsersViewController } from './controllers/users.controller';
import { ViewsIndexController } from './controllers/views-index.controller';

@Module({
  controllers: [
    ViewsIndexController,
    DashboardViewController,
    UsersViewController,
    RolesViewController,
    PoliciesViewController,
    AuditLogsViewController,
    SessionsViewController,
    SystemSettingViewController,
  ],
})
export class ViewsModule {}
