import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '@lib/config';

import { createMockConfigService } from '@apps/iam/test/mocks/mock-config-service';

import { PoliciesViewController } from '../../../src/modules/views/controllers/policies.controller';

describe('PoliciesViewController (Unit)', () => {
  let controller: PoliciesViewController;

  const mockConfigService = createMockConfigService();
  const MOCK_POLICY_ID = 'a1b2c3d4-0000-4000-8000-000000000099';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PoliciesViewController],
      providers: [{ provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    controller = module.get<PoliciesViewController>(PoliciesViewController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('page', () => {
    it('should return the title and admin view config locals for the policies index template', () => {
      const result = controller.page();

      expect(result.title).toBe('ERP IAM Admin - นโยบายความปลอดภัย');
      expect(result.prefix).toBe('iam/v1');
      expect(result.authApiBase).toBe('http://localhost:3001/auth/v1');
      expect(typeof result.assetVersion).toBe('string');
    });
  });

  describe('newPage', () => {
    it('should return a null policyId and the title for the create-policy form', () => {
      const result = controller.newPage();

      expect(result.title).toBe('ERP IAM Admin - สร้าง Policy ใหม่');
      expect(result.policyId).toBeNull();
      expect(result.prefix).toBe('iam/v1');
      expect(result.authApiBase).toBe('http://localhost:3001/auth/v1');
    });
  });

  describe('editPage', () => {
    it('should pass the route param through as policyId for the edit-policy form', () => {
      const result = controller.editPage(MOCK_POLICY_ID);

      expect(result.title).toBe('ERP IAM Admin - แก้ไข Policy');
      expect(result.policyId).toBe(MOCK_POLICY_ID);
      expect(result.prefix).toBe('iam/v1');
      expect(result.authApiBase).toBe('http://localhost:3001/auth/v1');
    });
  });
});
