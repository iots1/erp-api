import { Module } from '@nestjs/common';

import { AccessKeysViewController } from './controllers/access-keys.controller';
import { AuditLogsViewController } from './controllers/audit-logs.controller';
import { DashboardViewController } from './controllers/dashboard.controller';
import { DocumentTypesViewController } from './controllers/document-types.controller';
import { PermissionSyncLogsViewController } from './controllers/permission-sync-logs.controller';
import { PermissionsViewController } from './controllers/permissions.controller';
import { PoliciesViewController } from './controllers/policies.controller';
import { PrintTemplatesViewController } from './controllers/print-templates.controller';
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
    PermissionsViewController,
    PermissionSyncLogsViewController,
    AccessKeysViewController,
    PrintTemplatesViewController,
    DocumentTypesViewController,
    AuditLogsViewController,
    SessionsViewController,
    SystemSettingViewController,
  ],
})
export class ViewsModule {}
