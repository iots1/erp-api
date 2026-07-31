import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';

import {
  derivePermissionParts,
  derivePlaceholderName,
} from './permission-sync-scan.util';

import type * as ScanUtil from './permission-sync-scan.util';

/**
 * The scan functions resolve `apps/` from `process.cwd()` at module load (see
 * the docblock in the util — `__dirname` is meaningless once webpack bundles
 * this into an app's `main.js`). So a scan test builds a throwaway `apps/`
 * tree, points `process.cwd()` at its root, and re-requires the module in
 * isolation to pick up the new root.
 */
const createdRoots: string[] = [];
let cwdSpy: jest.SpyInstance<string, []>;
let warnSpy: jest.SpyInstance;

function loadScannerWithApps(tree: Record<string, string>): typeof ScanUtil {
  const root = mkdtempSync(join(tmpdir(), 'perm-sync-scan-'));
  createdRoots.push(root);

  for (const [relativePath, content] of Object.entries(tree)) {
    const fullPath = join(root, 'apps', relativePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, 'utf-8');
  }

  cwdSpy.mockReturnValue(root);

  let loaded: typeof ScanUtil | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = require('./permission-sync-scan.util') as typeof ScanUtil;
  });
  return loaded as typeof ScanUtil;
}

const byPermission = (rows: ScanUtil.IScannedPermission[]) =>
  new Map(rows.map((row) => [`${row.service}::${row.permission}`, row]));

beforeEach(() => {
  cwdSpy = jest.spyOn(process, 'cwd');
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  for (const root of createdRoots)
    rmSync(root, { recursive: true, force: true });
});

describe('derivePermissionParts', () => {
  /**
   * Regression guard for the Policy Generator's "หน้าจอ / Component Group (UI)"
   * dropdown: it groups ui rows by `resource`, so every page must derive its
   * own `page_<slug>` — deriving a bare `page` collapsed all pages onto one
   * dropdown entry *and* overwrote the seeded values on every sync.
   *
   * Each row here is a real `(permission, resource, action)` triple inserted by
   * a hand-written seed migration, so the scanner and the migrations can never
   * disagree about what a row's resource should be.
   */
  it.each([
    // libs/database/src/migrations/erp_iam/1752600001000-SeedIamBootstrapData.ts
    ['page:view_dashboard', 'page_dashboard', 'view_dashboard'],
    ['page:view_users', 'page_users', 'view_users'],
    ['component:btn_add_user', 'component', 'btn_add_user'],
    // 1784193362117-SeedIamUiPermissions.ts
    ['page:view_roles', 'page_roles', 'view_roles'],
    ['page:view_policies', 'page_policies', 'view_policies'],
    ['page:view_audit', 'page_audit', 'view_audit'],
    ['page:view_settings', 'page_settings', 'view_settings'],
    ['component:widget_total_users', 'component', 'widget_total_users'],
    ['component:btn_export_users', 'component', 'btn_export_users'],
    // one-page-per-migration seeds
    ['page:view_sessions', 'page_sessions', 'view_sessions'],
    ['page:view_permissions', 'page_permissions', 'view_permissions'],
    ['page:view_access_keys', 'page_access_keys', 'view_access_keys'],
    [
      'page:view_print_templates',
      'page_print_templates',
      'view_print_templates',
    ],
    ['page:view_document_types', 'page_document_types', 'view_document_types'],
    [
      'page:view_permission_sync_logs',
      'page_permission_sync_logs',
      'view_permission_sync_logs',
    ],
  ])(
    'derives %s the way the seed migrations do',
    (permission, resource, action) => {
      expect(derivePermissionParts(permission)).toEqual({ resource, action });
    },
  );

  it('keeps the prefix as the resource for api-plane permissions', () => {
    expect(derivePermissionParts('role:create')).toEqual({
      resource: 'role',
      action: 'create',
    });
    expect(derivePermissionParts('permission_sync:create')).toEqual({
      resource: 'permission_sync',
      action: 'create',
    });
  });

  it('groups a page declared without the view_ prefix with its view_ twin', () => {
    expect(derivePermissionParts('page:dashboard')).toEqual({
      resource: 'page_dashboard',
      action: 'dashboard',
    });
    expect(derivePermissionParts('page:dashboard')?.resource).toBe(
      derivePermissionParts('page:view_dashboard')?.resource,
    );
  });

  it('never derives an empty page resource from a degenerate slug', () => {
    expect(derivePermissionParts('page:view_')).toEqual({
      resource: 'page_view_',
      action: 'view_',
    });
  });

  it.each([
    ['', 'empty string'],
    ['view_dashboard', 'no colon'],
    ['page:', 'no action'],
    [':view_dashboard', 'no prefix'],
    ['page:view:dashboard', 'a second colon'],
    ['page:view-dashboard', 'a hyphen'],
    ['page: view_dashboard', 'whitespace'],
  ])('rejects %p (%s)', (permission) => {
    expect(derivePermissionParts(permission)).toBeNull();
  });
});

describe('derivePlaceholderName', () => {
  it.each([
    ['role:create', 'Create Role'],
    ['permission_sync:create', 'Create Permission Sync'],
    ['component:btn_add_user', 'Btn Add User Component'],
    // Built from the raw `page` prefix, not the derived `page_dashboard`
    // resource — otherwise this would read "View Dashboard Page Dashboard".
    ['page:view_dashboard', 'View Dashboard Page'],
  ])('humanizes %s as %p', (permission, expected) => {
    expect(derivePlaceholderName(permission)).toBe(expected);
  });

  it('falls back to humanizing the whole string when it is malformed', () => {
    expect(derivePlaceholderName('view_dashboard')).toBe('View Dashboard');
  });
});

describe('scanApiPermissions', () => {
  it('scans @RequirePermission() decorators with their bilingual name', () => {
    const scanner = loadScannerWithApps({
      'supplier-bc/src/suppliers.controller.ts': `
        @RequirePermission('supplier:create', { th: 'สร้างผู้ขาย', en: 'Create supplier' })
        create() {}
        @RequirePermission('supplier:read')
        read() {}
      `,
    });

    const rows = byPermission(scanner.scanApiPermissions());
    expect(rows.get('supplier-bc::supplier:create')).toEqual({
      service: 'supplier-bc',
      permission: 'supplier:create',
      resource: 'supplier',
      action: 'create',
      name: { th: 'สร้างผู้ขาย', en: 'Create supplier' },
      plane: 'api',
    });
    expect(rows.get('supplier-bc::supplier:read')?.name).toBeUndefined();
  });

  it('ignores spec files and never reads a service without a src dir', () => {
    const scanner = loadScannerWithApps({
      'iam/src/roles.controller.spec.ts': `@RequirePermission('role:delete')`,
      'frontend-web/ui-permissions.manifest.json': '{"pages":[]}',
    });

    expect(scanner.scanApiPermissions()).toEqual([]);
  });
});

describe('scanUiPermissions — data-permission attributes', () => {
  it('gives each page its own resource and shares one for components', () => {
    const scanner = loadScannerWithApps({
      'iam/views/pages/dashboard/index.ejs': `
        <a data-permission="page:view_dashboard">Dashboard</a>
        <div data-permission="component:widget_total_users"></div>
      `,
      'iam/public/js/roles.js': `{ permission: 'page:view_roles' }`,
    });

    const rows = byPermission(scanner.scanUiPermissions());
    expect(rows.get('iam::page:view_dashboard')).toMatchObject({
      resource: 'page_dashboard',
      action: 'view_dashboard',
      plane: 'ui',
      name: undefined,
    });
    expect(rows.get('iam::page:view_roles')?.resource).toBe('page_roles');
    expect(rows.get('iam::component:widget_total_users')?.resource).toBe(
      'component',
    );
  });

  it('does not mistake an api-plane string used client-side for a ui row', () => {
    const scanner = loadScannerWithApps({
      'iam/public/js/roles.js': `if (hasPermission('role:create')) show();`,
    });

    expect(scanner.scanUiPermissions()).toEqual([]);
  });

  it('keeps two services declaring the same page permission as separate rows', () => {
    const scanner = loadScannerWithApps({
      'iam/views/sidebar.ejs': `<a data-permission="page:view_dashboard"></a>`,
      'frontend-web/ui-permissions.manifest.json': JSON.stringify({
        pages: [
          {
            permission: 'page:view_dashboard',
            name: { th: 'หน้าแดชบอร์ด', en: 'Dashboard page' },
          },
        ],
      }),
    });

    const rows = scanner.scanUiPermissions();
    expect(
      rows.filter((r) => r.permission === 'page:view_dashboard'),
    ).toHaveLength(2);
    const services = rows.map((r) => r.service).sort();
    expect(services).toEqual(['frontend-web', 'iam']);
  });
});

describe('scanUiPermissions — ui-permissions.manifest.json', () => {
  const manifest = (value: unknown) =>
    typeof value === 'string' ? value : JSON.stringify(value);

  it('puts a nested component in its parent page group, not the generic one', () => {
    const scanner = loadScannerWithApps({
      'frontend-web/ui-permissions.manifest.json': manifest({
        pages: [
          {
            permission: 'page:view_reports',
            name: { th: 'หน้ารายงาน', en: 'Reports page' },
            components: [
              {
                permission: 'component:btn_export_reports',
                name: { th: 'ปุ่ม Export รายงาน', en: 'Export reports button' },
              },
            ],
          },
        ],
      }),
    });

    expect(scanner.scanUiPermissions()).toEqual([
      {
        service: 'frontend-web',
        permission: 'page:view_reports',
        resource: 'page_reports',
        action: 'view_reports',
        name: { th: 'หน้ารายงาน', en: 'Reports page' },
        plane: 'ui',
      },
      {
        service: 'frontend-web',
        // Inherited from `page:view_reports` so the Policy Generator offers a
        // single "หน้ารายงาน" group holding the page and its button together.
        permission: 'component:btn_export_reports',
        resource: 'page_reports',
        action: 'btn_export_reports',
        name: { th: 'ปุ่ม Export รายงาน', en: 'Export reports button' },
        plane: 'ui',
      },
    ]);
  });

  it('lets a manifest entry win over the same key found by attribute scan', () => {
    const scanner = loadScannerWithApps({
      'iam/views/sidebar.ejs': `<a data-permission="page:view_reports"></a>`,
      'iam/ui-permissions.manifest.json': manifest({
        pages: [
          {
            permission: 'page:view_reports',
            name: { th: 'หน้ารายงาน', en: 'Reports page' },
          },
        ],
      }),
    });

    const rows = scanner.scanUiPermissions();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toEqual({ th: 'หน้ารายงาน', en: 'Reports page' });
  });

  it('skips a manifest that is not valid JSON without failing other services', () => {
    const scanner = loadScannerWithApps({
      'frontend-web/ui-permissions.manifest.json': '{ "pages": [ ',
      'iam/views/sidebar.ejs': `<a data-permission="page:view_roles"></a>`,
    });

    expect(scanner.scanUiPermissions()).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('not valid JSON'),
    );
  });

  it.each([
    ['pages as an object', { pages: { permission: 'page:view_reports' } }],
    ['pages as a string', { pages: 'page:view_reports' }],
    ['a bare array', ['page:view_reports']],
    ['a JSON scalar', 42],
  ])('skips a manifest with %s instead of throwing', (_label, value) => {
    const scanner = loadScannerWithApps({
      'frontend-web/ui-permissions.manifest.json': manifest(value),
    });

    expect(scanner.scanUiPermissions()).toEqual([]);
  });

  it('skips a malformed entry but keeps its valid siblings', () => {
    const scanner = loadScannerWithApps({
      'frontend-web/ui-permissions.manifest.json': manifest({
        pages: [
          { name: { th: 'ไม่มีสิทธิ์', en: 'No permission field' } },
          { permission: 42 },
          { permission: 'view_reports' },
          {
            permission: 'page:view_reports',
            name: { th: 'หน้ารายงาน', en: 'Reports page' },
          },
        ],
      }),
    });

    const rows = scanner.scanUiPermissions();
    expect(rows.map((r) => r.permission)).toEqual(['page:view_reports']);
    expect(warnSpy).toHaveBeenCalledTimes(3);
  });

  it('refuses an api-plane permission smuggled into a ui manifest', () => {
    const scanner = loadScannerWithApps({
      'frontend-web/ui-permissions.manifest.json': manifest({
        pages: [
          {
            permission: 'role:create',
            name: { th: 'สร้างบทบาท', en: 'Create role' },
          },
        ],
      }),
    });

    expect(scanner.scanUiPermissions()).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('must be a "page:*" permission'),
    );
  });

  it('refuses an entry listed under the wrong level of the tree', () => {
    const scanner = loadScannerWithApps({
      'frontend-web/ui-permissions.manifest.json': manifest({
        pages: [
          // A component declared as a page would otherwise become its own
          // dropdown group; a page nested under components would inherit its
          // parent's resource and vanish into that group.
          { permission: 'component:btn_export_reports' },
          {
            permission: 'page:view_reports',
            name: { th: 'หน้ารายงาน', en: 'Reports page' },
            components: [{ permission: 'page:view_orders' }],
          },
        ],
      }),
    });

    const rows = scanner.scanUiPermissions();
    expect(rows.map((r) => r.permission)).toEqual(['page:view_reports']);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('must be a "page:*" permission'),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('must be a "component:*" permission'),
    );
  });

  it('leaves a component in the generic group when its page was rejected', () => {
    const scanner = loadScannerWithApps({
      'frontend-web/ui-permissions.manifest.json': manifest({
        pages: [
          {
            permission: 'page:view-reports',
            components: [
              {
                permission: 'component:btn_export_reports',
                name: { th: 'ปุ่ม Export รายงาน', en: 'Export reports button' },
              },
            ],
          },
        ],
      }),
    });

    const rows = scanner.scanUiPermissions();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      permission: 'component:btn_export_reports',
      resource: 'component',
    });
  });

  it('ignores a half-filled bilingual name so the placeholder is used instead', () => {
    const scanner = loadScannerWithApps({
      'frontend-web/ui-permissions.manifest.json': manifest({
        pages: [
          { permission: 'page:view_reports', name: { th: 'หน้ารายงาน' } },
          {
            permission: 'page:view_orders',
            name: { th: 'หน้าคำสั่งซื้อ', en: '  ' },
          },
        ],
      }),
    });

    for (const row of scanner.scanUiPermissions()) {
      expect(row.name).toBeUndefined();
    }
  });

  it('ignores a non-array components field but keeps the page itself', () => {
    const scanner = loadScannerWithApps({
      'frontend-web/ui-permissions.manifest.json': manifest({
        pages: [
          {
            permission: 'page:view_reports',
            name: { th: 'หน้ารายงาน', en: 'Reports page' },
            components: { permission: 'component:btn_export_reports' },
          },
        ],
      }),
    });

    const rows = scanner.scanUiPermissions();
    expect(rows.map((r) => r.permission)).toEqual(['page:view_reports']);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('must be an array'),
    );
  });

  it('accepts a page with no components field at all', () => {
    const scanner = loadScannerWithApps({
      'frontend-web/ui-permissions.manifest.json': manifest({
        pages: [
          {
            permission: 'page:view_reports',
            name: { th: 'หน้ารายงาน', en: 'Reports page' },
          },
        ],
      }),
    });

    expect(scanner.scanUiPermissions()).toHaveLength(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
