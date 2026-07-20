import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '@lib/config';

import { createMockConfigService } from '@apps/iam/test/mocks/mock-config-service';

import { DashboardViewController } from '../../../src/modules/views/controllers/dashboard.controller';

describe('DashboardViewController (Unit)', () => {
  let controller: DashboardViewController;

  const mockConfigService = createMockConfigService();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardViewController],
      providers: [{ provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    controller = module.get<DashboardViewController>(DashboardViewController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('page', () => {
    it('should return the title and admin view config locals for the dashboard template', () => {
      const result = controller.page();

      expect(result.title).toBe('ERP IAM Admin - แดชบอร์ด');
      expect(result.prefix).toBe('iam/v1');
      expect(result.authApiBase).toBe('http://localhost:3001/auth/v1');
      expect(typeof result.assetVersion).toBe('string');
    });
  });
});
