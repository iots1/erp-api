// Business logic for the document-types admin page. Like print-templates,
// this resource lives in report-bc, not iam — every API call goes through
// report-api.js's reportGet/Post/Put/Delete.
import { showConfirmDialog } from '../../../js/confirm-dialog.service.js';
import { hasPermission } from '../../../js/login.service.js';
import { createPaginatedList } from './paginated-list.js';
import { reportDelete, reportGet, reportPost, reportPut } from './report-api.js';
import { showApiError, showToast } from './toast.service.js';
import { escapeHtml, formatDateTime, refreshIcons } from './utils.js';

// Full, un-paginated print-template list — cached for the "print template"
// <select> on the document-type form, independent of the print-templates
// index page's own paginated/filtered table.
let printTemplatesLoaded = false;
let printTemplates = [];

async function ensurePrintTemplatesLoaded(force = false) {
  if (printTemplatesLoaded && !force) return printTemplates;
  const { items } = await reportGet('/print-templates', { ignore_limit: true, sort: 'code:asc' });
  printTemplates = items;
  printTemplatesLoaded = true;
  return items;
}

function printTemplateLabel(id) {
  const template = printTemplates.find((t) => t.id === id);
  // Response nests name_th/name_en as `name: {th, en}` (the global
  // LocalizationInterceptor collapses every _th/_en pair) — see the same
  // fix in print-templates.service.js.
  return template ? `${template.code} — ${template.name?.th}` : id;
}

// ── Document types index table — search + status filter + pagination ──

const query = { search: '', status: '' };
let currentItems = [];
let sort = 'created_at:desc';

const pager = createPaginatedList({
  defaultPageSize: 20,
  infoId: 'documentTypesPagerInfo',
  prevId: 'documentTypesPrevBtn',
  nextId: 'documentTypesNextBtn',
  tbodyId: 'documentTypeTableBody',
  columnCount: 6,
  fetchPage: async (page, pageSize) => {
    try {
      const or = query.search
        ? [`code||$cont||${query.search}`, `name_th||$cont||${query.search}`, `name_en||$cont||${query.search}`]
        : undefined;
      const filter = query.status ? [`is_active||$eq||${query.status}`] : [];

      const [{ items, pagination }] = await Promise.all([
        reportGet('/document-types', { page, limit: pageSize, sort, or, filter }),
        ensurePrintTemplatesLoaded(),
      ]);
      currentItems = items;
      renderDocumentTypesTable();
      return pagination;
    } catch (error) {
      showApiError(error, 'โหลดรายการประเภทเอกสารไม่สำเร็จ');
      return undefined;
    }
  },
});

export function loadDocumentTypes(page = 1) {
  return pager.load(page);
}

export function setDocumentTypesFilter({ search, status }) {
  if (search !== undefined) query.search = search.trim();
  if (status !== undefined) query.status = status;
  pager.load(1);
}

export function setDocumentTypesPageSize(size) {
  pager.setPageSize(size);
}

export function setDocumentTypesSort(newSort) {
  sort = newSort;
  pager.load(1);
}

export function goToDocumentTypesPage(direction) {
  return pager.goToPage(direction);
}

function renderDocumentTypesTable() {
  const tbody = document.getElementById('documentTypeTableBody');
  if (!tbody) return;

  if (currentItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="um-empty-cell">ไม่พบประเภทเอกสารที่ตรงกับเงื่อนไข</td></tr>`;
    return;
  }

  const canManage = hasPermission('report:document_type_update');
  const canDelete = hasPermission('report:document_type_delete');

  tbody.innerHTML = currentItems
    .map(
      (docType) => `
    <tr>
      <td><span class="um-mono-input">${escapeHtml(docType.code)}</span></td>
      <td>
        <p class="um-cell-title">${escapeHtml(docType.name?.th)}</p>
        <p class="um-cell-sub">${escapeHtml(docType.name?.en)}</p>
      </td>
      <td>${escapeHtml(printTemplateLabel(docType.print_template_id))}</td>
      <td>${docType.has_running_number ? `<span class="p-tag p-tag-sky">${escapeHtml(docType.running_number_format ?? '')}</span>` : '<span class="um-muted-note">ไม่มี</span>'}</td>
      <td><span class="p-tag ${docType.is_active ? 'p-tag-mint' : 'p-tag-pink'}">${docType.is_active ? 'Active' : 'Inactive'}</span></td>
      <td class="um-cell-actions">
        ${canManage ? `<a href="${window.__IAM_VIEWS_BASE__}/document-types/${docType.id}/edit" class="p-btn p-btn-ghost p-btn-sm"><i data-lucide="edit-3" class="um-icon-sm"></i> แก้ไข</a>` : ''}
        ${canDelete ? `<button type="button" class="p-btn p-btn-ghost p-btn-sm" onclick="confirmDeleteDocumentType('${docType.id}', '${escapeHtml(docType.code).replace(/'/g, "\\'")}')"><i data-lucide="trash-2" class="um-icon-sm"></i></button>` : ''}
      </td>
    </tr>
  `,
    )
    .join('');
  refreshIcons();
}

// ── Create / edit form page (apps/iam/views/pages/document-types/form.ejs) ──

export function toggleDocumentTypeRunningNumberFields() {
  const checked = document.getElementById('frmDocTypeHasRunningNumber').checked;
  document.getElementById('docTypeRunningNumberFields').classList.toggle('hidden', !checked);
  document.getElementById('frmDocTypeRunningNumberFormat').required = checked;
}

function renderPrintTemplateOptions(selectedId) {
  const select = document.getElementById('frmDocTypePrintTemplate');
  const options = printTemplates
    .map((t) => `<option value="${t.id}" ${t.id === selectedId ? 'selected' : ''}>${escapeHtml(t.code)} — ${escapeHtml(t.name?.th)}</option>`)
    .join('');
  select.innerHTML = `<option value="">— เลือก print template —</option>${options}`;
}

async function refreshRunningNumberStatus(documentTypeId) {
  const statusRow = document.getElementById('docTypeRunningNumberStatus');
  if (!documentTypeId || !document.getElementById('frmDocTypeHasRunningNumber').checked) {
    statusRow.classList.add('hidden');
    return;
  }
  try {
    const status = await reportGet(`/document-types/${documentTypeId}/running-number`);
    document.getElementById('docTypeLastRunningNumber').value = status.last_running_number;
    document.getElementById('docTypeLastValue').value = status.last_value ?? '-';
    document.getElementById('docTypeLastIssuedAt').value = status.last_issued_at
      ? formatDateTime(status.last_issued_at)
      : 'ยังไม่เคยออกเลข';
    statusRow.classList.remove('hidden');
  } catch (error) {
    showApiError(error, 'โหลดสถานะเลขที่เอกสารไม่สำเร็จ');
  }
}

export async function initDocumentTypeForm() {
  const form = document.getElementById('documentTypeForm');
  if (!form) return;

  const documentTypeId = document.getElementById('view-document-type-form').dataset.documentTypeId || null;
  form.dataset.editingId = documentTypeId ?? '';

  await ensurePrintTemplatesLoaded();
  renderPrintTemplateOptions(null);

  if (documentTypeId) {
    try {
      const docType = await reportGet(`/document-types/${documentTypeId}`);
      document.getElementById('frmDocTypeCode').value = docType.code;
      document.getElementById('frmDocTypeNameTh').value = docType.name?.th ?? '';
      document.getElementById('frmDocTypeNameEn').value = docType.name?.en ?? '';
      document.getElementById('frmDocTypeActive').checked = docType.is_active;
      document.getElementById('frmDocTypeHasRunningNumber').checked = docType.has_running_number;
      document.getElementById('frmDocTypeRunningNumberFormat').value = docType.running_number_format ?? '';
      renderPrintTemplateOptions(docType.print_template_id);
      toggleDocumentTypeRunningNumberFields();
      await refreshRunningNumberStatus(documentTypeId);
    } catch (error) {
      showApiError(error, 'โหลดข้อมูลประเภทเอกสารไม่สำเร็จ');
    }
  } else {
    toggleDocumentTypeRunningNumberFields();
  }
}

function buildDocumentTypePayload() {
  const hasRunningNumber = document.getElementById('frmDocTypeHasRunningNumber').checked;
  return {
    code: document.getElementById('frmDocTypeCode').value.trim(),
    name_th: document.getElementById('frmDocTypeNameTh').value.trim(),
    name_en: document.getElementById('frmDocTypeNameEn').value.trim(),
    print_template_id: document.getElementById('frmDocTypePrintTemplate').value,
    is_active: document.getElementById('frmDocTypeActive').checked,
    has_running_number: hasRunningNumber,
    running_number_format: hasRunningNumber
      ? document.getElementById('frmDocTypeRunningNumberFormat').value.trim()
      : null,
  };
}

export async function handleDocumentTypeFormSubmit(event) {
  event.preventDefault();
  const editingId = event.target.dataset.editingId || null;
  const payload = buildDocumentTypePayload();

  if (!payload.print_template_id) {
    showToast('กรุณาเลือก print template', 'error');
    return;
  }
  if (payload.has_running_number && !payload.running_number_format) {
    showToast('กรุณากรอกรูปแบบเลขที่เอกสาร', 'error');
    return;
  }

  try {
    if (editingId) {
      await reportPut(`/document-types/${editingId}`, payload);
    } else {
      await reportPost('/document-types', payload);
    }
    showToast('บันทึกประเภทเอกสารสำเร็จ', 'success');
    window.location.href = `${window.__IAM_VIEWS_BASE__}/document-types`;
  } catch (error) {
    showApiError(error, 'บันทึกประเภทเอกสารไม่สำเร็จ');
  }
}

// ── Test the running-number pattern in place (saves current edits first) ──

export async function generateDocumentTypeTestNumber() {
  const form = document.getElementById('documentTypeForm');
  const editingId = form?.dataset.editingId;
  if (!editingId) return;

  const payload = buildDocumentTypePayload();
  if (!payload.print_template_id) {
    showToast('กรุณาเลือก print template', 'error');
    return;
  }
  if (!payload.running_number_format) {
    showToast('กรุณากรอกรูปแบบเลขที่เอกสาร', 'error');
    return;
  }

  try {
    // Save first — the format the server tests against is whatever is
    // currently persisted, so an unsaved edit would test the old pattern.
    await reportPut(`/document-types/${editingId}`, payload);
    await reportPost(`/document-types/${editingId}/running-number/next`, {});
    showToast('ออกเลขทดสอบสำเร็จ', 'success');
    await refreshRunningNumberStatus(editingId);
  } catch (error) {
    showApiError(error, 'ออกเลขทดสอบไม่สำเร็จ');
  }
}

// ── Delete ───────────────────────────────────────────────────────────────

export async function confirmDeleteDocumentType(documentTypeId, code) {
  const confirmed = await showConfirmDialog({
    title: 'ลบประเภทเอกสาร',
    message: `ยืนยันการลบประเภทเอกสาร "${code}"?`,
    confirmText: 'ลบ',
  });
  if (!confirmed) return;
  try {
    await reportDelete(`/document-types/${documentTypeId}`);
    showToast('ลบประเภทเอกสารสำเร็จ', 'success');
    loadDocumentTypes(pager.getCurrentPage());
  } catch (error) {
    showApiError(error, 'ลบประเภทเอกสารไม่สำเร็จ');
  }
}
