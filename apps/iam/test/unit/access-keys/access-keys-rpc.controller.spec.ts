import type {
  IVerifyAccessKeySignaturePayload,
  IVerifyAccessKeySignatureResponse,
} from '@lib/common/constants/iam-message-patterns';
import type { IMicroservicePayload } from '@lib/common/interfaces/microservice.interface';

import { AccessKeysRpcController } from '@apps/iam/src/modules/access-keys/controllers/access-keys-rpc.controller';

export type MockAccessKeysService = {
  verifySignature: jest.Mock<
    Promise<IVerifyAccessKeySignatureResponse>,
    [IVerifyAccessKeySignaturePayload]
  >;
};

function createMockAccessKeysService(): MockAccessKeysService {
  return {
    verifySignature: jest.fn<
      Promise<IVerifyAccessKeySignatureResponse>,
      [IVerifyAccessKeySignaturePayload]
    >(),
  };
}

describe('AccessKeysRpcController', () => {
  let controller: AccessKeysRpcController;
  let mockService: MockAccessKeysService;

  beforeEach(() => {
    mockService = createMockAccessKeysService();
    controller = new AccessKeysRpcController(
      mockService as unknown as ConstructorParameters<
        typeof AccessKeysRpcController
      >[0],
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('verifySignature', () => {
    it('delegates to service.verifySignature with the unwrapped payload', async () => {
      const payload: IVerifyAccessKeySignaturePayload = {
        access_key_id: 'AKIA1234567890ABCDEF',
        string_to_sign: 'GET\n/x\n123\nhash',
        provided_signature: 'sig',
        source_ip: '10.0.0.1',
      };
      const message: IMicroservicePayload<IVerifyAccessKeySignaturePayload> = {
        payload,
      } as IMicroservicePayload<IVerifyAccessKeySignaturePayload>;
      const response: IVerifyAccessKeySignatureResponse = {
        valid: true,
        context: null,
      };
      mockService.verifySignature.mockResolvedValue(response);

      const result = await controller.verifySignature(message);

      expect(mockService.verifySignature).toHaveBeenCalledWith(payload);
      expect(result).toBe(response);
    });

    it('propagates a not-valid response with a reason when verification fails', async () => {
      const payload: IVerifyAccessKeySignaturePayload = {
        access_key_id: 'AKIA_UNKNOWN',
        string_to_sign: 'GET\n/x\n123\nhash',
        provided_signature: 'sig',
        source_ip: null,
      };
      const message: IMicroservicePayload<IVerifyAccessKeySignaturePayload> = {
        payload,
      } as IMicroservicePayload<IVerifyAccessKeySignaturePayload>;
      const response: IVerifyAccessKeySignatureResponse = {
        valid: false,
        context: null,
        reason: 'Access Key not found',
      };
      mockService.verifySignature.mockResolvedValue(response);

      const result = await controller.verifySignature(message);

      expect(result).toEqual(response);
    });
  });
});
