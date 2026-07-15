import { Module } from '@nestjs/common';

import { CommonModule } from '@lib/common';
import { ConfigModule } from '@lib/config';

@Module({
  imports: [ConfigModule, CommonModule],
})
export class AuthModule {}
