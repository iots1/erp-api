import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { BaseServiceOperations } from '@lib/common/utils/base-operations/base-service-operations.util';
import { ConfigService } from '@lib/config';

import { LoginHistory } from '../entities/login-history.entity';

/** Read-only — login_histories rows are written exclusively by AuthService.login(). */
@Injectable()
export class LoginHistoriesService extends BaseServiceOperations<
  LoginHistory,
  Partial<LoginHistory>,
  Partial<LoginHistory>
> {
  constructor(
    protected readonly logger: LogsService,
    configService: ConfigService,
    @InjectRepository(LoginHistory, ErpDatabases.AUTH)
    loginHistoryRepository: Repository<LoginHistory>,
  ) {
    super(loginHistoryRepository, {
      logging: {
        logger: logger,
        serviceName: configService.get('AUTH_PREFIX_NAME'),
        serviceVersion: configService.get('AUTH_PREFIX_VERSION'),
      },
    });
  }
}
