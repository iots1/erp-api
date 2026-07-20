import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '@lib/config';

import { createMockConfigService } from '@apps/iam/test/mocks/mock-config-service';

import { ViewsIndexController } from '../../../src/modules/views/controllers/views-index.controller';

describe('ViewsIndexController (Unit)', () => {
  let controller: ViewsIndexController;

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('index', () => {
    it('should be defined', async () => {
      const mockConfigService = createMockConfigService();
      const module: TestingModule = await Test.createTestingModule({
        controllers: [ViewsIndexController],
        providers: [{ provide: ConfigService, useValue: mockConfigService }],
      }).compile();

      controller = module.get<ViewsIndexController>(ViewsIndexController);

      expect(controller).toBeDefined();
    });

    it('should redirect to the dashboard using the configured prefix/version', async () => {
      const mockConfigService = createMockConfigService();
      const module: TestingModule = await Test.createTestingModule({
        controllers: [ViewsIndexController],
        providers: [{ provide: ConfigService, useValue: mockConfigService }],
      }).compile();

      controller = module.get<ViewsIndexController>(ViewsIndexController);

      const result = controller.index();

      expect(result).toEqual({ url: '/iam/v1/views/dashboard' });
    });

    it('should fall back to default prefix/version when not configured', async () => {
      const mockConfigService = createMockConfigService({
        IAM_PREFIX_NAME: '',
        IAM_PREFIX_VERSION: '',
      });
      // ConfigService.get returning undefined triggers the `?? 'iam'`/`?? 'v1'` fallback.
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'IAM_PREFIX_NAME' || key === 'IAM_PREFIX_VERSION') {
          return undefined;
        }
        return undefined;
      });

      const module: TestingModule = await Test.createTestingModule({
        controllers: [ViewsIndexController],
        providers: [{ provide: ConfigService, useValue: mockConfigService }],
      }).compile();

      controller = module.get<ViewsIndexController>(ViewsIndexController);

      const result = controller.index();

      expect(result).toEqual({ url: '/iam/v1/views/dashboard' });
    });

    it('should use a custom prefix/version when configured', async () => {
      const mockConfigService = createMockConfigService({
        IAM_PREFIX_NAME: 'custom-iam',
        IAM_PREFIX_VERSION: 'v2',
      });

      const module: TestingModule = await Test.createTestingModule({
        controllers: [ViewsIndexController],
        providers: [{ provide: ConfigService, useValue: mockConfigService }],
      }).compile();

      controller = module.get<ViewsIndexController>(ViewsIndexController);

      const result = controller.index();

      expect(result).toEqual({ url: '/custom-iam/v2/views/dashboard' });
    });
  });
});
