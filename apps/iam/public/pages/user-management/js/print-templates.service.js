// Business logic for the print-templates admin page. The resource itself
// lives in report-bc (see apps/report-bc/src/modules/print-template), not
// iam — every API call here goes through report-api.js's reportGet/Post/
// Put/Delete instead of api.js's iamGet/Post/Put/Delete.
import { showConfirmDialog } from '../../../js/confirm-dialog.service.js';
import { hasPermission } from '../../../js/login.service.js';
import { createHtmlEditor } from './codemirror-html-editor.js';
import { createPaginatedList } from './paginated-list.js';
import { reportDelete, reportGet, reportPost, reportPostBlob, reportPut } from './report-api.js';
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
        <p class="um-cell-title">${escapeHtml(template.name?.th)}</p>
        <p class="um-cell-sub">${escapeHtml(template.name?.en)}</p>
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

let htmlEditor = null;
let currentParameters = []; // [{ key, label_th, label_en, default_value, _test_value }] — _test_value is UI-only, stripped before save
let isFullscreen = false;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Mirrors PrintTemplatesService.substituteParameters() on the backend, so
 * the live preview matches what render() will actually produce. */
function substituteParameters(html, parameters) {
  return parameters.reduce((acc, p) => {
    if (!p.key) return acc;
    const value = p._test_value ?? p.default_value ?? '';
    return acc.replace(new RegExp(`{{\\s*${escapeRegExp(p.key)}\\s*}}`, 'g'), value);
  }, html);
}

let previewBlobUrl = null;
let previewRequestId = 0;

function setPreviewLoading(isLoading) {
  document.getElementById('templatePreviewLoading')?.classList.toggle('hidden', !isLoading);
  // Gotenberg round-trips take real server time (unlike the old instant
  // srcdoc swap) — show a skeleton over the previous render so the pane
  // never looks frozen/blank while waiting.
  document.getElementById('templatePreviewSkeleton')?.classList.toggle('is-visible', isLoading);
}

/** Renders the current (unsaved) editor content through the real Gotenberg
 * pipeline (POST /print-templates/preview) instead of an iframe srcdoc, so
 * the preview matches actual print output (fonts, page breaks, @media
 * print rules) rather than a plain-browser approximation of it. */
async function updatePreview() {
  const frame = document.getElementById('templatePreviewFrame');
  if (!frame || !htmlEditor) return;

  const html = substituteParameters(htmlEditor.getValue(), currentParameters);
  if (!html.trim()) {
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      previewBlobUrl = null;
    }
    frame.removeAttribute('src');
    return;
  }

  const requestId = ++previewRequestId;
  setPreviewLoading(true);
  try {
    const blob = await reportPostBlob('/print-templates/preview', {
      html_content: html,
      paper_size: document.getElementById('frmTemplatePaperSize')?.value || 'A4',
      orientation: document.getElementById('frmTemplateOrientation')?.value || 'portrait',
    });
    if (requestId !== previewRequestId) return; // superseded by a newer edit
    const url = URL.createObjectURL(blob);
    if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    previewBlobUrl = url;
    frame.src = url;
  } catch (error) {
    if (requestId !== previewRequestId) return;
    showApiError(error, 'สร้างตัวอย่าง PDF ไม่สำเร็จ');
  } finally {
    if (requestId === previewRequestId) setPreviewLoading(false);
  }
}

// ── Parameters editor ────────────────────────────────────────────────────

function renderParametersRows() {
  const container = document.getElementById('templateParametersContainer');
  if (!container) return;

  if (currentParameters.length === 0) {
    container.innerHTML = `<p class="um-parameters-empty">ยังไม่มีตัวแปร — กด "เพิ่มตัวแปร" เพื่อเริ่มกำหนด</p>`;
  } else {
    container.innerHTML = currentParameters
      .map(
        (p, i) => `
      <div class="um-parameter-row">
        <input type="text" value="${escapeHtml(p.key)}" placeholder="key เช่น customer_name" class="um-mono-input" oninput="updatePrintTemplateParameterField(${i}, 'key', this.value)">
        <input type="text" value="${escapeHtml(p.label_th)}" placeholder="ป้ายกำกับ (ไทย)" oninput="updatePrintTemplateParameterField(${i}, 'label_th', this.value)">
        <input type="text" value="${escapeHtml(p.label_en)}" placeholder="Label (English)" oninput="updatePrintTemplateParameterField(${i}, 'label_en', this.value)">
        <input type="text" value="${escapeHtml(p.default_value ?? '')}" placeholder="ค่าเริ่มต้น" oninput="updatePrintTemplateParameterField(${i}, 'default_value', this.value)">
        <button type="button" class="p-btn p-btn-ghost p-btn-sm" onclick="removePrintTemplateParameterRow(${i})">
          <i data-lucide="trash-2" class="um-icon-sm"></i>
        </button>
      </div>
    `,
      )
      .join('');
  }
  refreshIcons();
  renderTestParamsRow();
}

export function addPrintTemplateParameterRow() {
  currentParameters.push({ key: '', label_th: '', label_en: '', default_value: '', _test_value: '' });
  renderParametersRows();
}

export function removePrintTemplateParameterRow(index) {
  currentParameters.splice(index, 1);
  renderParametersRows();
  updatePreview();
}

/** Updates one field of one parameter without re-rendering the row inputs —
 * re-rendering on every keystroke would steal focus from whatever input the
 * admin is currently typing in. */
export function updatePrintTemplateParameterField(index, field, value) {
  const param = currentParameters[index];
  if (!param) return;
  param[field] = value;
  renderTestParamsRow();
  updatePreview();
}

// ── Test-parameter values (preview-only, never sent to the server) ─────────

function renderTestParamsRow() {
  const container = document.getElementById('templateTestParamsContainer');
  if (!container) return;

  const withKeys = currentParameters.filter((p) => p.key.trim() !== '');
  container.classList.toggle('hidden', withKeys.length === 0);
  if (withKeys.length === 0) return;

  container.innerHTML = currentParameters
    .map((p, i) => {
      if (!p.key.trim()) return '';
      return `
      <div class="um-test-param-field">
        <label for="testParam_${i}">${escapeHtml(p.label_th || p.key)}</label>
        <input type="text" id="testParam_${i}" value="${escapeHtml(p._test_value ?? p.default_value ?? '')}"
          placeholder="{{${escapeHtml(p.key)}}}" oninput="updatePrintTemplateTestValue(${i}, this.value)">
      </div>
    `;
    })
    .join('');
}

export function updatePrintTemplateTestValue(index, value) {
  const param = currentParameters[index];
  if (!param) return;
  param._test_value = value;
  updatePreview();
}

// ── View mode (split / code / preview) ──────────────────────────────────

export function setPrintTemplateViewMode(mode) {
  const split = document.getElementById('templateEditorSplit');
  const editorPane = document.getElementById('templateEditorPane');
  if (!split) return;
  split.classList.remove('um-view-mode-code', 'um-view-mode-preview');
  if (mode === 'code') split.classList.add('um-view-mode-code');
  if (mode === 'preview') split.classList.add('um-view-mode-preview');

  // code/preview are single-pane (CSS grows that pane to 100% — see
  // .um-view-mode-code/.um-view-mode-preview in layout.css), so any %-basis
  // left over from a drag would otherwise stick around and fight it once
  // the admin switches back; restore the last dragged ratio for split mode,
  // and go back to CSS's 50/50 default when neither has run yet.
  if (editorPane) {
    editorPane.style.flexBasis = mode === 'split' && lastSplitPct != null ? `${lastSplitPct}%` : '';
  }

  document.querySelectorAll('.um-view-toggle-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.viewMode === mode);
  });
}

// ── Resizable split — drag templateEditorResizer to reallocate width ────────

const SPLIT_MIN_PCT = 20;
const SPLIT_MAX_PCT = 80;
let lastSplitPct = null;

function initSplitResizer() {
  const resizer = document.getElementById('templateEditorResizer');
  const split = document.getElementById('templateEditorSplit');
  const editorPane = document.getElementById('templateEditorPane');
  if (!resizer || !split || !editorPane) return;

  let activePointerId = null;
  let rafId = null;
  let pendingClientX = null;

  function setSplitPct(pct) {
    const clamped = Math.min(SPLIT_MAX_PCT, Math.max(SPLIT_MIN_PCT, pct));
    lastSplitPct = clamped;
    editorPane.style.flexBasis = `${clamped}%`;
  }

  function applyClientX(clientX) {
    const rect = split.getBoundingClientRect();
    setSplitPct(((clientX - rect.left) / rect.width) * 100);
  }

  // rAF-throttled: CodeMirror re-lays-out its whole viewport on every resize
  // of its mount, so applying the raw flex-basis on every single pointermove
  // (which can fire far faster than the browser can repaint/relayout) is
  // what made the drag feel laggy and stop tracking the cursor — collapsing
  // every move between frames down to the latest position keeps it in sync
  // with what the browser can actually paint.
  function flushFrame() {
    rafId = null;
    if (pendingClientX !== null) {
      applyClientX(pendingClientX);
      pendingClientX = null;
    }
  }

  function onPointerMove(event) {
    if (event.pointerId !== activePointerId) return;
    pendingClientX = event.clientX;
    if (rafId === null) rafId = requestAnimationFrame(flushFrame);
    event.preventDefault();
  }

  function endDrag(event) {
    if (activePointerId === null) return;
    if (event && event.pointerId !== activePointerId) return;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    pendingClientX = null;
    if (resizer.hasPointerCapture(activePointerId)) {
      resizer.releasePointerCapture(activePointerId);
    }
    activePointerId = null;
    resizer.classList.remove('is-dragging');
    split.classList.remove('is-resizing');
    document.body.style.removeProperty('cursor');
    document.body.style.removeProperty('user-select');
    window.removeEventListener('blur', forceEndDrag);
  }

  function forceEndDrag() {
    endDrag(null);
  }

  function startDrag(event) {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    activePointerId = event.pointerId;
    // setPointerCapture pins every subsequent pointer event for this
    // pointerId to `resizer` regardless of what's visually underneath the
    // cursor (the preview iframe's own document, CodeMirror's internals,
    // etc.) — the standard fix for a drag handle that crosses an iframe,
    // and what actually guarantees pointerup fires so the drag can never
    // get stuck in "is-dragging" if the release happens over one of them.
    resizer.setPointerCapture(activePointerId);
    resizer.classList.add('is-dragging');
    split.classList.add('is-resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    // A window-level fallback in case the OS/browser eats the pointerup
    // entirely (e.g. alt-tabbing away mid-drag) — capture alone still
    // relies on an eventual pointerup/cancel to release itself.
    window.addEventListener('blur', forceEndDrag);
    event.preventDefault();
  }

  resizer.addEventListener('pointerdown', startDrag);
  resizer.addEventListener('pointermove', onPointerMove);
  resizer.addEventListener('pointerup', endDrag);
  resizer.addEventListener('pointercancel', endDrag);
  resizer.addEventListener('keydown', (event) => {
    const rect = split.getBoundingClientRect();
    const currentPct = (editorPane.getBoundingClientRect().width / rect.width) * 100;
    if (event.key === 'ArrowLeft') setSplitPct(currentPct - 2);
    else if (event.key === 'ArrowRight') setSplitPct(currentPct + 2);
    else return;
    event.preventDefault();
  });
}

// ── Fullscreen (Dreamweaver-style distraction-free editing) ────────────────

function exitFullscreenOnEscape(event) {
  if (event.key === 'Escape' && isFullscreen) togglePrintTemplateFullscreen();
}

export function togglePrintTemplateFullscreen() {
  const section = document.getElementById('templateHtmlSection');
  const btn = document.getElementById('printTemplateFullscreenBtn');
  if (!section || !btn) return;

  isFullscreen = !isFullscreen;
  section.classList.toggle('um-editor-fullscreen', isFullscreen);
  btn.innerHTML = isFullscreen
    ? '<i data-lucide="minimize" class="um-icon-sm"></i> Exit Fullscreen'
    : '<i data-lucide="maximize" class="um-icon-sm"></i> Fullscreen';
  refreshIcons();

  if (isFullscreen) {
    document.addEventListener('keydown', exitFullscreenOnEscape);
  } else {
    document.removeEventListener('keydown', exitFullscreenOnEscape);
  }
}

// ── Form init / submit ──────────────────────────────────────────────────

function buildPrintTemplatePayload() {
  return {
    code: document.getElementById('frmTemplateCode').value.trim(),
    name_th: document.getElementById('frmTemplateNameTh').value.trim(),
    name_en: document.getElementById('frmTemplateNameEn').value.trim(),
    description_th: document.getElementById('frmTemplateDescriptionTh').value.trim() || null,
    description_en: document.getElementById('frmTemplateDescriptionEn').value.trim() || null,
    html_content: htmlEditor.getValue(),
    is_active: document.getElementById('frmTemplateActive').checked,
    paper_size: document.getElementById('frmTemplatePaperSize').value,
    orientation: document.getElementById('frmTemplateOrientation').value,
    parameters: currentParameters
      .filter((p) => p.key.trim() !== '')
      .map((p) => ({
        key: p.key.trim(),
        label_th: p.label_th.trim(),
        label_en: p.label_en.trim(),
        default_value: p.default_value?.trim() || null,
      })),
  };
}

export async function initPrintTemplateForm() {
  const form = document.getElementById('printTemplateForm');
  if (!form) return;

  const templateId = document.getElementById('view-print-template-form').dataset.printTemplateId || null;
  form.dataset.editingId = templateId ?? '';
  document.getElementById('printTemplateGeneratePdfBtn')?.classList.toggle('hidden', !templateId);

  htmlEditor = createHtmlEditor({
    mountEl: document.getElementById('templateHtmlEditorMount'),
    initialDoc: '',
    // Preview now round-trips through Gotenberg (see updatePreview) instead
    // of an instant srcdoc render — a longer debounce avoids firing a real
    // PDF conversion on every keystroke.
    onChange: debounce(updatePreview, 900),
  });

  document.getElementById('frmTemplatePaperSize')?.addEventListener('change', updatePreview);
  document.getElementById('frmTemplateOrientation')?.addEventListener('change', updatePreview);
  initSplitResizer();

  if (templateId) {
    try {
      const template = await reportGet(`/print-templates/${templateId}`);
      // GET responses nest every `_th`/`_en` pair as `{ th, en }` — the
      // global LocalizationInterceptor does this for top-level fields
      // (name_th/name_en → name.th/name.en) and even inside a jsonb array
      // (parameters[].label_th/label_en → parameters[].label.th/en). Flatten
      // back to what the flat-key form inputs (and submit payload) expect.
      document.getElementById('frmTemplateCode').value = template.code;
      document.getElementById('frmTemplateNameTh').value = template.name?.th ?? '';
      document.getElementById('frmTemplateNameEn').value = template.name?.en ?? '';
      document.getElementById('frmTemplateDescriptionTh').value = template.description?.th ?? '';
      document.getElementById('frmTemplateDescriptionEn').value = template.description?.en ?? '';
      document.getElementById('frmTemplateActive').checked = template.is_active;
      document.getElementById('frmTemplatePaperSize').value = template.paper_size ?? 'A4';
      document.getElementById('frmTemplateOrientation').value = template.orientation ?? 'portrait';
      currentParameters = (template.parameters ?? []).map((p) => ({
        key: p.key,
        label_th: p.label?.th ?? '',
        label_en: p.label?.en ?? '',
        default_value: p.default_value ?? '',
        _test_value: p.default_value ?? '',
      }));
      htmlEditor.setValue(template.html_content ?? '');
    } catch (error) {
      showApiError(error, 'โหลดข้อมูลเทมเพลตไม่สำเร็จ');
    }
  }

  renderParametersRows();
  updatePreview();
}

export async function handlePrintTemplateFormSubmit(event) {
  event.preventDefault();
  const editingId = event.target.dataset.editingId || null;
  const payload = buildPrintTemplatePayload();

  if (!payload.html_content.trim()) {
    showToast('กรุณากรอกเนื้อหา HTML', 'error');
    setPrintTemplateViewMode('code');
    return;
  }

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

// ── Generate test PDF (saves current edits in place, then renders) ─────────

export async function generatePrintTemplateTestPdf() {
  const form = document.getElementById('printTemplateForm');
  const editingId = form?.dataset.editingId;
  if (!editingId) return;

  const payload = buildPrintTemplatePayload();
  if (!payload.html_content.trim()) {
    showToast('กรุณากรอกเนื้อหา HTML', 'error');
    return;
  }

  const testParams = {};
  currentParameters.forEach((p) => {
    if (p.key.trim()) testParams[p.key.trim()] = p._test_value ?? p.default_value ?? '';
  });

  try {
    // Save first — render() reads the persisted object from storage, so a
    // stale save would produce a PDF that doesn't match what's in the editor.
    await reportPut(`/print-templates/${editingId}`, payload);
    const result = await reportPost(`/print-templates/${editingId}/render`, { params: testParams });
    window.open(result.url, '_blank', 'noopener');
  } catch (error) {
    showApiError(error, 'สร้าง PDF ทดสอบไม่สำเร็จ');
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
