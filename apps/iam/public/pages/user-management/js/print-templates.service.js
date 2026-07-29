// Business logic for the print-templates admin page. The resource itself
// lives in report-bc (see apps/report-bc/src/modules/print-template), not
// iam — every API call here goes through report-api.js's reportGet/Post/
// Put/Delete instead of api.js's iamGet/Post/Put/Delete.
import { showConfirmDialog } from '../../../js/confirm-dialog.service.js';
import { hasPermission } from '../../../js/login.service.js';
import { createPaginatedList } from './paginated-list.js';
import { reportDelete, reportGet, reportPost, reportPut } from './report-api.js';
import { showApiError, showToast } from './toast.service.js';
import { debounce, escapeHtml, refreshIcons } from './utils.js';

// ── Print templates index table — search + status filter + pagination ──

const query = { search: '', status: '' };
let currentItems = [];

const pager = createPaginatedList({
  defaultPageSize: 20,
  infoId: 'printTemplatesPagerInfo',
  prevId: 'printTemplatesPrevBtn',
  nextId: 'printTemplatesNextBtn',
  tbodyId: 'printTemplateTableBody',
  columnCount: 4,
  fetchPage: async (page, pageSize) => {
    try {
      const or = query.search
        ? [`code||$cont||${query.search}`, `name_th||$cont||${query.search}`, `name_en||$cont||${query.search}`]
        : undefined;
      const filter = query.status ? [`is_active||$eq||${query.status}`] : [];

      const { items, pagination } = await reportGet('/print-templates', {
        page,
        limit: pageSize,
        sort: 'created_at:desc',
        or,
        filter,
      });
      currentItems = items;
      renderPrintTemplatesTable();
      return pagination;
    } catch (error) {
      showApiError(error, 'โหลดรายการเทมเพลตไม่สำเร็จ');
      return undefined;
    }
  },
});

export function loadPrintTemplates(page = 1) {
  return pager.load(page);
}

export function setPrintTemplatesFilter({ search, status }) {
  if (search !== undefined) query.search = search.trim();
  if (status !== undefined) query.status = status;
  pager.load(1);
}

export function setPrintTemplatesPageSize(size) {
  pager.setPageSize(size);
}

export function goToPrintTemplatesPage(direction) {
  return pager.goToPage(direction);
}

function renderPrintTemplatesTable() {
  const tbody = document.getElementById('printTemplateTableBody');
  if (!tbody) return;

  if (currentItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="um-empty-cell">ไม่พบเทมเพลตที่ตรงกับเงื่อนไข</td></tr>`;
    return;
  }

  const canManage = hasPermission('report:print_template_update');
  const canDelete = hasPermission('report:print_template_delete');

  tbody.innerHTML = currentItems
    .map(
      (template) => `
    <tr>
      <td><span class="um-mono-input">${escapeHtml(template.code)}</span></td>
      <td>
        <p class="um-cell-title">${escapeHtml(template.name_th)}</p>
        <p class="um-cell-sub">${escapeHtml(template.name_en)}</p>
      </td>
      <td><span class="p-tag ${template.is_active ? 'p-tag-mint' : 'p-tag-pink'}">${template.is_active ? 'Active' : 'Inactive'}</span></td>
      <td class="um-cell-actions">
        ${canManage ? `<a href="${window.__IAM_VIEWS_BASE__}/print-templates/${template.id}/edit" class="p-btn p-btn-ghost p-btn-sm"><i data-lucide="edit-3" class="um-icon-sm"></i> แก้ไข</a>` : ''}
        ${canDelete ? `<button type="button" class="p-btn p-btn-ghost p-btn-sm" onclick="confirmDeletePrintTemplate('${template.id}', '${escapeHtml(template.code).replace(/'/g, "\\'")}')"><i data-lucide="trash-2" class="um-icon-sm"></i></button>` : ''}
      </td>
    </tr>
  `,
    )
    .join('');
  refreshIcons();
}

// ── Create / edit form page (apps/iam/views/pages/print-templates/form.ejs) ──

function updatePreview() {
  const editor = document.getElementById('frmTemplateHtml');
  const frame = document.getElementById('templatePreviewFrame');
  if (!editor || !frame) return;
  frame.srcdoc = editor.value;
}

export async function initPrintTemplateForm() {
  const form = document.getElementById('printTemplateForm');
  if (!form) return;

  const templateId = document.getElementById('view-print-template-form').dataset.printTemplateId || null;
  form.dataset.editingId = templateId ?? '';

  const editor = document.getElementById('frmTemplateHtml');
  editor.addEventListener('input', debounce(updatePreview, 200));

  if (templateId) {
    try {
      const template = await reportGet(`/print-templates/${templateId}`);
      document.getElementById('frmTemplateCode').value = template.code;
      document.getElementById('frmTemplateNameTh').value = template.name_th;
      document.getElementById('frmTemplateNameEn').value = template.name_en;
      document.getElementById('frmTemplateDescriptionTh').value = template.description_th ?? '';
      document.getElementById('frmTemplateDescriptionEn').value = template.description_en ?? '';
      document.getElementById('frmTemplateActive').checked = template.is_active;
      editor.value = template.html_content ?? '';
    } catch (error) {
      showApiError(error, 'โหลดข้อมูลเทมเพลตไม่สำเร็จ');
    }
  }

  updatePreview();
}

export async function handlePrintTemplateFormSubmit(event) {
  event.preventDefault();
  const editingId = event.target.dataset.editingId || null;

  const payload = {
    code: document.getElementById('frmTemplateCode').value.trim(),
    name_th: document.getElementById('frmTemplateNameTh').value.trim(),
    name_en: document.getElementById('frmTemplateNameEn').value.trim(),
    description_th: document.getElementById('frmTemplateDescriptionTh').value.trim() || null,
    description_en: document.getElementById('frmTemplateDescriptionEn').value.trim() || null,
    html_content: document.getElementById('frmTemplateHtml').value,
    is_active: document.getElementById('frmTemplateActive').checked,
  };

  try {
    if (editingId) {
      await reportPut(`/print-templates/${editingId}`, payload);
    } else {
      await reportPost('/print-templates', payload);
    }
    showToast('บันทึกเทมเพลตสำเร็จ', 'success');
    window.location.href = `${window.__IAM_VIEWS_BASE__}/print-templates`;
  } catch (error) {
    showApiError(error, 'บันทึกเทมเพลตไม่สำเร็จ');
  }
}

// ── Delete ───────────────────────────────────────────────────────────────

export async function confirmDeletePrintTemplate(templateId, code) {
  const confirmed = await showConfirmDialog({
    title: 'ลบเทมเพลต',
    message: `ยืนยันการลบเทมเพลต "${code}"?`,
    confirmText: 'ลบ',
  });
  if (!confirmed) return;
  try {
    await reportDelete(`/print-templates/${templateId}`);
    showToast('ลบเทมเพลตสำเร็จ', 'success');
    loadPrintTemplates(pager.getCurrentPage());
  } catch (error) {
    showApiError(error, 'ลบเทมเพลตไม่สำเร็จ');
  }
}
