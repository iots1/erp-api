import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import {
  AuthMessagePatterns,
  ICreateInitialCredentialPayload,
  ICreateInitialCredentialResponse,
  IResetPasswordPayload,
  IResetPasswordResponse,
} from '@lib/common/constants/auth-message-patterns';
import type { IMicroservicePayload } from '@lib/common/interfaces/microservice.interface';
import { RmqAckInterceptor } from '@lib/common/utils/rmq-ack-interceptor.util';

import { AuthService } from '../services/auth.service';

@Controller()
@UseInterceptors(RmqAckInterceptor)
export class CredentialEventsController {
  constructor(private readonly authService: AuthService) {}

  @MessagePattern({ cmd: AuthMessagePatterns.CreateInitialCredential })
  async createInitialCredential(
    @Payload() message: IMicroservicePayload<ICreateInitialCredentialPayload>,
  ): Promise<ICreateInitialCredentialResponse> {
    await this.authService.createInitialCredential(message.payload);
    return { success: true };
  }

  @MessagePattern({ cmd: AuthMessagePatterns.ResetPassword })
  async resetPassword(
    @Payload() message: IMicroservicePayload<IResetPasswordPayload>,
  ): Promise<IResetPasswordResponse> {
    await this.authService.resetPassword(message.payload);
    return { success: true };
  }
}
