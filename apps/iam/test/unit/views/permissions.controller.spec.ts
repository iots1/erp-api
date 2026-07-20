import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '@lib/config';

import { createMockConfigService } from '@apps/iam/test/mocks/mock-config-service';

import { PermissionsViewController } from '../../../src/modules/views/controllers/permissions.controller';

describe('PermissionsViewController (Unit)', () => {
  let controller: PermissionsViewController;

  const mockConfigService = createMockConfigService();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PermissionsViewController],
      providers: [{ provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    controller = module.get<PermissionsViewController>(
      PermissionsViewController,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('page', () => {
    it('should return the title and admin view config locals for the permissions template', () => {
      const result = controller.page();

      expect(result.title).toBe('ERP IAM Admin - จัดการสิทธิ์');
      expect(result.prefix).toBe('iam/v1');
      expect(result.authApiBase).toBe('http://localhost:3001/auth/v1');
      expect(typeof result.assetVersion).toBe('string');
    });
  });
});
