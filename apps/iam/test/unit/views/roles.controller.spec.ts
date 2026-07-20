import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '@lib/config';

import { createMockConfigService } from '@apps/iam/test/mocks/mock-config-service';

import { RolesViewController } from '../../../src/modules/views/controllers/roles.controller';

describe('RolesViewController (Unit)', () => {
  let controller: RolesViewController;

  const mockConfigService = createMockConfigService();
  const MOCK_ROLE_ID = 'a1b2c3d4-0000-4000-8000-000000000088';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesViewController],
      providers: [{ provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    controller = module.get<RolesViewController>(RolesViewController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('page', () => {
    it('should return the title and admin view config locals for the roles index template', () => {
      const result = controller.page();

      expect(result.title).toBe('ERP IAM Admin - สิทธิ์การใช้งาน (Roles)');
      expect(result.prefix).toBe('iam/v1');
      expect(result.authApiBase).toBe('http://localhost:3001/auth/v1');
      expect(typeof result.assetVersion).toBe('string');
    });
  });

  describe('newPage', () => {
    it('should return a null roleId and the title for the create-role form', () => {
      const result = controller.newPage();

      expect(result.title).toBe(
        'ERP IAM Admin - เพิ่มสิทธิ์การใช้งานใหม่ (Roles)',
      );
      expect(result.roleId).toBeNull();
      expect(result.prefix).toBe('iam/v1');
      expect(result.authApiBase).toBe('http://localhost:3001/auth/v1');
    });
  });

  describe('editPage', () => {
    it('should pass the route param through as roleId for the edit-role form', () => {
      const result = controller.editPage(MOCK_ROLE_ID);

      expect(result.title).toBe('ERP IAM Admin - แก้ไขสิทธิ์การใช้งาน (Roles)');
      expect(result.roleId).toBe(MOCK_ROLE_ID);
      expect(result.prefix).toBe('iam/v1');
      expect(result.authApiBase).toBe('http://localhost:3001/auth/v1');
    });
  });
});
