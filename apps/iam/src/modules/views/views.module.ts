import { Module } from '@nestjs/common';

import { UserManagementViewController } from './controllers/user-management.controller';

@Module({
  controllers: [UserManagementViewController],
})
export class ViewsModule {}
