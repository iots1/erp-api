import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import {
  IamMessagePatterns,
  IVerifyAccessKeySignaturePayload,
  IVerifyAccessKeySignatureResponse,
} from '@lib/common/constants/iam-message-patterns';
import type { IMicroservicePayload } from '@lib/common/interfaces/microservice.interface';
import { RmqAckInterceptor } from '@lib/common/utils/rmq-ack-interceptor.util';

import { AccessKeysService } from '../services/access-keys.service';

@Controller()
@UseInterceptors(RmqAckInterceptor)
export class AccessKeysRpcController {
  constructor(private readonly accessKeysService: AccessKeysService) {}

  @MessagePattern({ cmd: IamMessagePatterns.VerifyAccessKeySignature })
  verifySignature(
    @Payload() message: IMicroservicePayload<IVerifyAccessKeySignaturePayload>,
  ): Promise<IVerifyAccessKeySignatureResponse> {
    return this.accessKeysService.verifySignature(message.payload);
  }
}
