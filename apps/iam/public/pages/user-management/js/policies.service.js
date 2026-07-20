import { showConfirmDialog } from '../../../js/confirm-dialog.service.js';
import { hasPermission } from '../../../js/login.service.js';
import { iamDelete, iamGet, iamPost, iamPut } from './api.js';
import { createPaginatedList } from './paginated-list.js';
import {
  ensurePermissionsCatalog,
  findPermissionByStringInPlane,
  getDropdown1Options,
  getDropdown2Options,
  getMatchingPermissions,
  groupPermissionsByResource,
} from './permissions.service.js';
import { resetPolicyFormDraft, state } from './state.js';
import { showApiError, showToast } from './toast.service.js';
import { escapeHtml, refreshIcons, uid } from './utils.js';
import { switchView } from './views.service.js';

const CONDITION_OPERATORS = [
  { val: 'StringEquals', label: 'เท่ากับ (StringEquals)' },
  { val: 'StringNotEquals', label: 'ไม่เท่ากับ (StringNotEquals)' },
  { val: 'StringLike', label: 'มีคำว่า (StringLike)' },
  { val: 'NumericLessThan', label: 'น้อยกว่า (NumericLessThan)' },
  { val: 'NumericGreaterThan', label: 'มากกว่า (NumericGreaterThan)' },
  { val: 'DateGreaterThan', label: 'เวลาหลัง (DateGreaterThan)' },
  { val: 'DateLessThan', label: 'เวลาก่อน (DateLessThan)' },
  { val: 'IpAddress', label: 'IP อยู่ในเครือข่าย (IpAddress)' },
];

const CONDITION_KEY_SUGGESTIONS = [
  'department',
  'warehouse.branch_id',
  'created_by',
  'context.business_hours',
];

// Full, un-paginated list — cached for consumers that need every policy at
// once (the "attach policies" checkbox grid in roles.service.js), independent
// of the policies *index page*'s own paginated/filtered list below.
export async function ensurePoliciesLoaded(force = false) {
  if (state.policies.length > 0 && !force) return state.policies;
  const { items } = await iamGet('/policies', {
    ignore_limit: true,
    sort: 'name_th:asc',
  });
  state.policies = items;
  return items;
}

// ── Policies index list — search + status filter + pagination ──────

const query = { search: '', status: '' };
let currentItems = [];

const pager = createPaginatedList({
  defaultPageSize: 20,
  infoId: 'policiesPagerInfo',
  prevId: 'policiesPrevBtn',
  nextId: 'policiesNextBtn',
  fetchPage: async (page, pageSize) => {
    try {
      const filter = [];
      if (query.status === 'active') filter.push('is_active||$eq||true');
      if (query.status === 'inactive') filter.push('is_active||$eq||false');

      const or = query.search
        ? [
            `code||$cont||${query.search}`,
            `name_th||$cont||${query.search}`,
            `name_en||$cont||${query.search}`,
          ]
        : undefined;

      const { items, pagination } = await iamGet('/policies', {
        page,
        limit: pageSize,
        sort: 'name_th:asc',
        filter,
        or,
      });
      currentItems = items;
      renderPoliciesList();
      return pagination;
    } catch (error) {
      showApiError(error, 'โหลดรายการนโยบายไม่สำเร็จ');
      return undefined;
    }
  },
});

export function loadPolicies(page = 1) {
  return pager.load(page);
}

export function setPoliciesFilter({ search, status }) {
  if (search !== undefined) query.search = search.trim();
  if (status !== undefined) query.status = status;
  pager.load(1);
}

export function setPoliciesPageSize(size) {
  pager.setPageSize(size);
}

export function goToPoliciesPage(direction) {
  return pager.goToPage(direction);
}

function renderPoliciesList() {
  const tbody = document.getElementById('policyTableBody');
  if (!tbody) return;

  if (currentItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="um-empty-cell">ไม่พบ Policy ที่ตรงกับเงื่อนไข</td></tr>`;
    return;
  }

  const canManage = hasPermission('policy:create');
  tbody.innerHTML = currentItems
    .map(
      (policy) => `
    <tr>
      <td>
        <p class="um-cell-title">${escapeHtml(policy.name?.th)}</p>
        <p class="um-cell-sub">${escapeHtml(policy.name?.en)}</p>
      </td>
      <td class="um-cell-mono">${escapeHtml(policy.code)}</td>
      <td><span class="p-tag ${policy.is_active ? 'p-tag-mint' : 'p-tag-pink'}">${policy.is_active ? 'Active' : 'Inactive'}</span></td>
      <td class="um-cell-actions">
        ${canManage ? `<button type="button" class="p-btn p-btn-ghost p-btn-sm" onclick="openPolicyForm('${policy.id}')"><i data-lucide="edit-3" class="um-icon-sm"></i> แก้ไข</button>` : ''}
        ${canManage ? `<button type="button" class="p-btn p-btn-ghost p-btn-sm" onclick="confirmDeletePolicy('${policy.id}', '${escapeHtml(policy.code).replace(/'/g, "\\'")}')"><i data-lucide="trash-2" class="um-icon-sm"></i></button>` : ''}
      </td>
    </tr>
  `,
    )
    .join('');
  refreshIcons();
}

export async function confirmDeletePolicy(policyId, code) {
  const confirmed = await showConfirmDialog({
    title: 'ลบ Policy',
    message: `ยืนยันการลบ Policy "${code}"?`,
    confirmText: 'ลบ',
  });
  if (!confirmed) return;
  try {
    await iamDelete(`/policies/${policyId}`);
    showToast('ลบ Policy สำเร็จ', 'success');
    loadPolicies(pager.getCurrentPage());
  } catch (error) {
    showApiError(error, 'ลบ Policy ไม่สำเร็จ');
  }
}

// ── Policy generator (create / edit) ────────────────────────────

export async function openPolicyForm(policyId) {
  switchView('policy-form');
  resetPolicyFormDraft();
  state.policyForm.editingId = policyId ?? null;

  const form = document.getElementById('policyForm');
  form.reset();
  document.getElementById('policyFormTitle').textContent = policyId
    ? 'แก้ไข Policy (Policy Generator)'
    : 'สร้าง Policy ใหม่ (Policy Generator)';

  try {
    await ensurePermissionsCatalog();

    if (policyId) {
      const [policy, { items: statements }] = await Promise.all([
        iamGet(`/policies/${policyId}`),
        iamGet(`/policies/${policyId}/statements`),
      ]);
      document.getElementById('frmPolCode').value = policy.code;
      document.getElementById('frmPolNameTh').value = policy.name?.th ?? '';
      document.getElementById('frmPolNameEn').value = policy.name?.en ?? '';
      document.getElementById('frmPolActive').checked = policy.is_active;

      state.policyForm.statements = statements.map((statement) => {
        const services = [...new Set(statement.targets.map((t) => t.service))];
        return {
          effect: statement.effect,
          plane: statement.plane,
          service: services,
          resource: [...new Set(statement.targets.map((t) => t.resource))],
          permission_ids: statement.permissions
            .map(
              (p) =>
                findPermissionByStringInPlane(p, statement.plane, services)?.id,
            )
            .filter(Boolean),
          permissionsDisplay: statement.permissions,
          conditions: statement.conditions,
        };
      });
    } else {
      document.getElementById('frmPolCode').value = 'POL_';
    }

    setStatementType('ui');
    renderStatementsTable();
  } catch (error) {
    showApiError(error, 'โหลดข้อมูล Policy ไม่สำเร็จ');
  }
}

export function setStatementType(plane) {
  state.policyForm.activeType = plane;
  document.getElementById('stmtPlane').value = plane;

  document
    .getElementById('btnTypeUI')
    .classList.toggle('active', plane === 'ui');
  document
    .getElementById('btnTypeAPI')
    .classList.toggle('active', plane === 'api');

  const isApi = plane === 'api';
  document.getElementById('labelDD1').textContent = isApi
    ? 'Service (API)'
    : 'หน้าจอ / Component Group (UI)';
  document.getElementById('containerDD2').classList.toggle('hidden', !isApi);
  document.getElementById('actionsLabel').textContent = isApi
    ? 'เลือก Actions (สิทธิ์การกระทำ)'
    : 'เลือก Components ในหน้าจอ';

  resetStatementDraftSelection();
}

function resetStatementDraftSelection() {
  state.policyForm.multiSelect = { dd1: [], dd2: [] };
  state.policyForm.conditionRows = [];
  document.getElementById('searchDd1').value = '';
  document.getElementById('searchDd2').value = '';
  renderMultiSelect('dd1');
  renderMultiSelect('dd2');
  renderActionCheckboxes();
  renderConditions();
}

export function toggleMultiDropdown(id) {
  document.querySelectorAll('.um-multi-dropdown').forEach((dropdown) => {
    if (dropdown.id !== id) dropdown.classList.add('hidden');
  });
  document.getElementById(id).classList.toggle('hidden');
}

function currentDdOptions(ddKey) {
  const { activeType, multiSelect } = state.policyForm;
  if (ddKey === 'dd1') return getDropdown1Options(activeType);
  return getDropdown2Options(multiSelect.dd1);
}

export function renderMultiSelect(ddKey) {
  const container = document.getElementById(`${ddKey}OptionsList`);
  if (!container) return;
  const searchValue = document
    .getElementById(`search${ddKey === 'dd1' ? 'Dd1' : 'Dd2'}`)
    .value.toLowerCase();
  const options = currentDdOptions(ddKey).filter((opt) =>
    opt.label.toLowerCase().includes(searchValue),
  );
  const selected = state.policyForm.multiSelect[ddKey];
  const allSelected =
    options.length > 0 && options.every((opt) => selected.includes(opt.id));

  let html = `
    <label class="um-dropdown-option um-dropdown-option-all w-full">
      <input type="checkbox" onchange="toggleSelectAllMulti('${ddKey}', this.checked)" ${allSelected ? 'checked' : ''}>
      <span>เลือกทั้งหมด (Select All)</span>
    </label>
  `;
  if (options.length === 0) {
    html += `<div class="um-muted-note um-dropdown-empty">ไม่พบข้อมูล</div>`;
  }
  html += options
    .map(
      (opt) => `
    <label class="um-dropdown-option">
      <input type="checkbox" value="${opt.id}" onchange="toggleOptionMulti('${ddKey}', '${opt.id}', this.checked)" ${selected.includes(opt.id) ? 'checked' : ''}>
      <span>${escapeHtml(opt.label)}</span>
    </label>
  `,
    )
    .join('');
  container.innerHTML = html;

  const labelEl = document.getElementById(`${ddKey}Label`);
  const typeLabel =
    state.policyForm.activeType === 'api'
      ? ddKey === 'dd1'
        ? 'Service'
        : 'Resource'
      : 'หน้าจอ';
  labelEl.textContent =
    selected.length === 0
      ? `เลือก ${typeLabel}...`
      : `เลือกแล้ว ${selected.length} รายการ`;
  labelEl.classList.toggle('um-dropdown-label-active', selected.length > 0);
}

export function toggleSelectAllMulti(ddKey, isChecked) {
  const searchValue = document
    .getElementById(`search${ddKey === 'dd1' ? 'Dd1' : 'Dd2'}`)
    .value.toLowerCase();
  const options = currentDdOptions(ddKey).filter((opt) =>
    opt.label.toLowerCase().includes(searchValue),
  );
  const selected = state.policyForm.multiSelect[ddKey];

  if (isChecked) {
    for (const opt of options)
      if (!selected.includes(opt.id)) selected.push(opt.id);
  } else {
    state.policyForm.multiSelect[ddKey] = selected.filter(
      (id) => !options.some((opt) => opt.id === id),
    );
  }
  renderMultiSelect(ddKey);
  if (ddKey === 'dd1' && state.policyForm.activeType === 'api') {
    state.policyForm.multiSelect.dd2 = [];
    renderMultiSelect('dd2');
  }
  renderActionCheckboxes();
}

export function toggleOptionMulti(ddKey, id, isChecked) {
  const selected = state.policyForm.multiSelect[ddKey];
  state.policyForm.multiSelect[ddKey] = isChecked
    ? [...selected, id]
    : selected.filter((val) => val !== id);
  renderMultiSelect(ddKey);
  if (ddKey === 'dd1' && state.policyForm.activeType === 'api') {
    state.policyForm.multiSelect.dd2 = [];
    renderMultiSelect('dd2');
  }
  renderActionCheckboxes();
}

export function renderActionCheckboxes() {
  const container = document.getElementById('actionsCheckboxContainer');
  const { activeType, multiSelect } = state.policyForm;

  const selection =
    activeType === 'api'
      ? { services: multiSelect.dd1, resources: multiSelect.dd2 }
      : { resources: multiSelect.dd1 };
  const ready =
    activeType === 'api'
      ? multiSelect.dd1.length > 0 && multiSelect.dd2.length > 0
      : multiSelect.dd1.length > 0;

  if (!ready) {
    container.innerHTML = `<span class="um-muted-note">กรุณาเลือกข้อมูลด้านบนก่อน</span>`;
    return;
  }

  const permissions = getMatchingPermissions(activeType, selection);
  const groups = groupPermissionsByResource(permissions);

  let html = '';
  let groupIndex = 0;
  for (const [resource, perms] of groups) {
    const groupId = `actionGroup${groupIndex++}`;
    html += `
      <div class="um-action-group" id="${groupId}">
        <h4 class="um-action-group-title">
          <span class="um-action-group-title-text"><i data-lucide="${activeType === 'ui' ? 'layout' : 'folder-key'}" class="um-icon-sm"></i> ${escapeHtml(resource)}</span>
          <label class="um-action-group-select-all">
            <input type="checkbox" onchange="toggleGroupActions('${groupId}', this.checked)">
            เลือกทั้งหมด
          </label>
        </h4>
        <div class="um-action-grid">
          ${perms
            .map(
              (p) => `
            <label class="um-checkbox-card">
              <input type="checkbox" name="stmtActions" value="${p.id}" onchange="syncGroupSelectAll('${groupId}')">
              <div>
                <span class="um-checkbox-title">${escapeHtml(p.permission_name?.th)}</span>
                <span class="um-checkbox-sub">${escapeHtml(p.permission_name?.en ?? p.permission)}</span>
              </div>
            </label>
          `,
            )
            .join('')}
        </div>
      </div>
    `;
  }
  container.innerHTML = html;
  refreshIcons();
}

export function toggleGroupActions(groupId, isChecked) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll('input[name="stmtActions"]').forEach((cb) => {
    cb.checked = isChecked;
  });
}

export function syncGroupSelectAll(groupId) {
  const group = document.getElementById(groupId);
  if (!group) return;
  const checkboxes = [...group.querySelectorAll('input[name="stmtActions"]')];
  const groupSelectAll = group.querySelector('.um-action-group-select-all input');
  if (!groupSelectAll) return;
  const checkedCount = checkboxes.filter((cb) => cb.checked).length;
  groupSelectAll.checked = checkedCount === checkboxes.length;
  groupSelectAll.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
}

export function selectAllActions() {
  const checkboxes = document.querySelectorAll('input[name="stmtActions"]');
  const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
  checkboxes.forEach((cb) => {
    cb.checked = !allChecked;
  });
  document.querySelectorAll('.um-action-group').forEach((group) => syncGroupSelectAll(group.id));
}

// ── Conditions builder ───────────────────────────────────────────

export function addConditionRow() {
  state.policyForm.conditionRows.push({
    id: uid('cond'),
    operator: 'StringEquals',
    condition_key: 'department',
    condition_value: '',
  });
  renderConditions();
}

export function removeConditionRow(id) {
  state.policyForm.conditionRows = state.policyForm.conditionRows.filter(
    (row) => row.id !== id,
  );
  renderConditions();
}

export function updateConditionRow(id, field, value) {
  const row = state.policyForm.conditionRows.find((r) => r.id === id);
  if (row) row[field] = value;
}

function renderConditions() {
  const container = document.getElementById('conditionBuilderRows');
  if (!container) return;
  const rows = state.policyForm.conditionRows;

  if (rows.length === 0) {
    container.innerHTML = `<div class="um-muted-note um-condition-empty">ไม่ได้ระบุ Condition</div>`;
    return;
  }

  const opOptions = CONDITION_OPERATORS.map(
    (op) => `<option value="${op.val}">${op.label}</option>`,
  ).join('');
  const keyListId = 'conditionKeySuggestions';

  container.innerHTML =
    `<datalist id="${keyListId}">${CONDITION_KEY_SUGGESTIONS.map((k) => `<option value="${k}">`).join('')}</datalist>` +
    rows
      .map(
        (row, index) => `
      <div class="um-condition-row">
        ${index > 0 ? '<span class="p-tag p-tag-sky">AND</span>' : '<span class="um-condition-spacer"></span>'}
        <select onchange="updateConditionRow('${row.id}', 'operator', this.value)">${opOptions.replace(`value="${row.operator}"`, `value="${row.operator}" selected`)}</select>
        <input type="text" list="${keyListId}" value="${escapeHtml(row.condition_key)}" placeholder="condition key" onchange="updateConditionRow('${row.id}', 'condition_key', this.value)">
        <input type="text" value="${escapeHtml(row.condition_value)}" placeholder="value" onchange="updateConditionRow('${row.id}', 'condition_value', this.value)">
        <button type="button" class="p-btn p-btn-ghost p-btn-sm" onclick="removeConditionRow('${row.id}')"><i data-lucide="trash-2" class="um-icon-sm"></i></button>
      </div>
    `,
      )
      .join('');
  refreshIcons();
}

// ── Step 3: statements table ─────────────────────────────────────

export function addStatementToDraft() {
  const effect = document.getElementById('stmtEffect').value;
  const { activeType, multiSelect } = state.policyForm;

  let service;
  let resource;
  if (activeType === 'api') {
    if (multiSelect.dd1.length === 0 || multiSelect.dd2.length === 0) {
      showToast('กรุณาเลือก Service และ Resource', 'error');
      return;
    }
    const allServices = getDropdown1Options('api');
    const allResources = getDropdown2Options(multiSelect.dd1);
    service =
      multiSelect.dd1.length === allServices.length
        ? ['*']
        : [...multiSelect.dd1];
    resource =
      multiSelect.dd2.length === allResources.length
        ? ['*']
        : [...multiSelect.dd2];
  } else {
    if (multiSelect.dd1.length === 0) {
      showToast('กรุณาเลือกหน้าจอ (Page)', 'error');
      return;
    }
    const allPages = getDropdown1Options('ui');
    service = ['frontend-ui'];
    resource =
      multiSelect.dd1.length === allPages.length ? ['*'] : [...multiSelect.dd1];
  }

  const checked = Array.from(
    document.querySelectorAll('input[name="stmtActions"]:checked'),
  );
  if (checked.length === 0) {
    showToast('กรุณาเลือกอย่างน้อย 1 Action/Component', 'error');
    return;
  }

  const permissionIds = checked.map((cb) => cb.value);
  const permissionsDisplay = permissionIds
    .map(
      (id) =>
        state.permissionsCatalog.find((p) => p.id === id)?.permission_name?.th,
    )
    .filter(Boolean);

  const conditions = state.policyForm.conditionRows
    .filter((row) => row.condition_key && row.condition_value)
    .map(({ operator, condition_key, condition_value }) => ({
      operator,
      condition_key,
      condition_value,
    }));

  state.policyForm.statements.push({
    effect,
    plane: activeType,
    service,
    resource,
    permission_ids: permissionIds,
    permissionsDisplay,
    conditions,
  });

  renderStatementsTable();
  resetStatementDraftSelection();
}

export function removeStatementFromDraft(index) {
  state.policyForm.statements.splice(index, 1);
  renderStatementsTable();
}

function renderStatementsTable() {
  const tbody = document.getElementById('statementsTableBody');
  document.getElementById('stmtCountBadge').textContent =
    state.policyForm.statements.length;

  if (state.policyForm.statements.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="um-empty-cell">ยังไม่มี Statement กรุณาเพิ่มจาก Step 2</td></tr>`;
    return;
  }

  tbody.innerHTML = state.policyForm.statements
    .map((stmt, index) => {
      const effectTag = stmt.effect === 'allow' ? 'p-tag-mint' : 'p-tag-pink';
      const planeTag = stmt.plane === 'ui' ? 'p-tag-lavender' : 'p-tag-peach';
      const renderChips = (arr) =>
        arr
          .map(
            (v) =>
              `<span class="p-tag p-tag-sky um-chip">${escapeHtml(v)}</span>`,
          )
          .join(' ');
      const actionsHtml = stmt.permissionsDisplay
        .map(
          (name) =>
            `<span class="p-tag p-tag-sky um-chip">✓ ${escapeHtml(name)}</span>`,
        )
        .join(' ');
      const conditionsHtml =
        stmt.conditions.length === 0
          ? '<span class="um-muted-note">None</span>'
          : `<pre class="um-condition-preview">${escapeHtml(JSON.stringify(stmt.conditions, null, 2))}</pre>`;

      return `
      <tr>
        <td><span class="p-tag ${effectTag}">${stmt.effect}</span> <span class="p-tag ${planeTag}">${stmt.plane}</span></td>
        <td>${renderChips(stmt.service)}</td>
        <td>${renderChips(stmt.resource)}</td>
        <td>${actionsHtml}</td>
        <td>${conditionsHtml}</td>
        <td class="um-cell-actions"><button type="button" class="p-btn p-btn-ghost p-btn-sm" onclick="removeStatementFromDraft(${index})"><i data-lucide="trash-2" class="um-icon-sm"></i></button></td>
      </tr>
    `;
    })
    .join('');
  refreshIcons();
}

export async function handlePolicyFormSubmit(event) {
  event.preventDefault();
  if (state.policyForm.statements.length === 0) {
    showToast('ต้องมีอย่างน้อย 1 Statement', 'error');
    return;
  }

  const payload = {
    code: document.getElementById('frmPolCode').value.trim(),
    name_th: document.getElementById('frmPolNameTh').value.trim(),
    name_en: document.getElementById('frmPolNameEn').value.trim(),
    is_active: document.getElementById('frmPolActive').checked,
  };

  const statements = state.policyForm.statements.map((s) => ({
    effect: s.effect,
    plane: s.plane,
    service: s.service,
    resource: s.resource,
    permission_ids: s.permission_ids,
    conditions: s.conditions,
  }));

  try {
    const policy = state.policyForm.editingId
      ? await iamPut(`/policies/${state.policyForm.editingId}`, payload)
      : await iamPost('/policies', payload);
    await iamPut(`/policies/${policy.id}/statements`, { statements });

    showToast('บันทึก Policy สำเร็จ', 'success');
    switchView('policies');
    loadPolicies(pager.getCurrentPage());
  } catch (error) {
    showApiError(error, 'บันทึก Policy ไม่สำเร็จ');
  }
}
