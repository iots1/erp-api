import { Controller, NotFoundException } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import {
  IamMessagePatterns,
  IIamUser,
} from '@lib/common/constants/iam-message-patterns';
import type {
  IEvaluateConditionsPayload,
  IFindByIdPayload,
  IResolvePermissionsPayload,
} from '@lib/common/constants/iam-message-patterns';
import type { IMicroservicePayload } from '@lib/common/interfaces/microservice.interface';

import { User } from '../../users/entities/user.entity';
import {
  IPermissionResolution,
  PermissionResolverService,
} from '../services/permission-resolver.service';

@Controller()
export class AccessEventsController {
  constructor(
    @InjectRepository(User, ErpDatabases.IAM)
    private readonly userRepository: Repository<User>,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  @MessagePattern({ cmd: IamMessagePatterns.FindById })
  async findById(
    @Payload() message: IMicroservicePayload<IFindByIdPayload>,
  ): Promise<IIamUser> {
    const user = await this.userRepository.findOne({
      where: { id: message.payload.user_id, is_deleted: false },
    });
    if (!user) {
      throw new NotFoundException(
        `User '${message.payload.user_id}' not found.`,
      );
    }
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      department: user.department,
      status: user.status,
    };
  }

  @MessagePattern({ cmd: IamMessagePatterns.ResolvePermissions })
  resolvePermissions(
    @Payload() message: IMicroservicePayload<IResolvePermissionsPayload>,
  ): Promise<IPermissionResolution> {
    return this.permissionResolver.resolveForUser(message.payload.user_id);
  }

  @MessagePattern({ cmd: IamMessagePatterns.EvaluateConditions })
  evaluateConditions(
    @Payload() message: IMicroservicePayload<IEvaluateConditionsPayload>,
  ): Promise<boolean> {
    const { user_id, service, resource, action, context } = message.payload;
    return this.permissionResolver.evaluate(
      user_id,
      service,
      `${resource}:${action}`,
      context,
    );
  }
}
