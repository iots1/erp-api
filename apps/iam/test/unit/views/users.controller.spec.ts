import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '@lib/config';

import { createMockConfigService } from '@apps/iam/test/mocks/mock-config-service';

import { UsersViewController } from '../../../src/modules/views/controllers/users.controller';

describe('UsersViewController (Unit)', () => {
  let controller: UsersViewController;

  const mockConfigService = createMockConfigService();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersViewController],
      providers: [{ provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    controller = module.get<UsersViewController>(UsersViewController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('page', () => {
    it('should return the title and admin view config locals for the users template', () => {
      const result = controller.page();

      expect(result.title).toBe('ERP IAM Admin - จัดการผู้ใช้งาน');
      expect(result.prefix).toBe('iam/v1');
      expect(result.authApiBase).toBe('http://localhost:3001/auth/v1');
      expect(typeof result.assetVersion).toBe('string');
    });
  });
});
