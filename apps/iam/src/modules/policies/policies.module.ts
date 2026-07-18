import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule, ErpDatabases } from '@lib/common';

import { AccessModule } from '../access/access.module';
import { PoliciesController } from './controllers/policies.controller';
import { Policy } from './entities/policy.entity';
import { PolicyStatement } from './entities/policy-statement.entity';
import { StatementAction } from './entities/statement-action.entity';
import { StatementCondition } from './entities/statement-condition.entity';
import { StatementTarget } from './entities/statement-target.entity';
import { PoliciesService } from './services/policies.service';

@Module({
  imports: [
    CommonModule,
    AccessModule,
    TypeOrmModule.forFeature(
      [
        Policy,
        PolicyStatement,
        StatementTarget,
        StatementAction,
        StatementCondition,
      ],
      ErpDatabases.IAM,
    ),
  ],
  controllers: [PoliciesController],
  providers: [PoliciesService],
  exports: [PoliciesService],
})
export class PoliciesModule {}
