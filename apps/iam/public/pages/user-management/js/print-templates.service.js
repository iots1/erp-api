// Business logic for the print-templates admin page. The resource itself
// lives in report-bc (see apps/report-bc/src/modules/print-template), not
// iam — every API call here goes through report-api.js's reportGet/Post/
// Put/Delete instead of api.js's iamGet/Post/Put/Delete.
import { hasPermission } from '../../../js/login.service.js';
import { createHtmlEditor } from './codemirror-html-editor.js';
import { createJavascriptEditor } from './codemirror-javascript-editor.js';
import { createJsonEditor } from './codemirror-json-editor.js';
import { confirmAndRun } from './confirm-action.js';
import { createPaginatedList } from './paginated-list.js';
import { reportDelete, reportGet, reportPost, reportPostBlob, reportPut } from './report-api.js';
import { showApiError, showToast } from './toast.service.js';
import { debounce, escapeHtml, refreshIcons } from './utils.js';

// ── Print templates index table — search + status filter + pagination ──

const query = { search: '', status: '' };
let currentItems = [];
let sort = 'created_at:desc';

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
        sort,
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

export function setPrintTemplatesSort(newSort) {
  sort = newSort;
  pager.load(1);
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
        ${canManage ? `<a href="${window.__IAM_VIEWS_BASE__}/print-templates/${template.id}/edit" class="p-btn p-btn-ghost p-btn-ghost-primary p-btn-sm" title="แก้ไข"><i data-lucide="edit-3" class="um-icon-sm"></i></a>` : ''}
        ${canDelete ? `<button type="button" class="p-btn p-btn-ghost p-btn-ghost-danger p-btn-sm" onclick="confirmDeletePrintTemplate('${template.id}', '${escapeHtml(template.code).replace(/'/g, "\\'")}')" title="ลบ"><i data-lucide="trash-2" class="um-icon-sm"></i></button>` : ''}
      </td>
    </tr>
  `,
    )
    .join('');
  refreshIcons();
}

// ── Create / edit form page (apps/iam/views/pages/print-templates/form.ejs) ──

let htmlEditor = null;
let mockDataEditor = null;
let jsEditor = null;
let currentParameters = []; // [{ key, label_th, label_en, default_value, _test_value }] — _test_value is UI-only, stripped before save
let isFullscreen = false;
let isMockDataFullscreen = false;

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
 * print rules) rather than a plain-browser approximation of it.
 *
 * 'simple' substitutes {{key}} client-side first (as before) — 'banded'
 * can't do that in the browser (band/loop substitution needs the paginator,
 * which only runs server-side against real Gotenberg — see
 * BandedRenderService), so it sends the raw html_content + mock_data
 * straight through and lets the server inject the paginator itself. */
async function updatePreview() {
  const frame = document.getElementById('templatePreviewFrame');
  if (!frame || !htmlEditor) return;

  const rawHtml = htmlEditor.getValue();
  if (!rawHtml.trim()) {
    // Bump previewRequestId even though nothing is fetched here — otherwise
    // an older still-in-flight request (started before the editor was
    // cleared) would find its requestId still matches on resolve and
    // overwrite the frame we're about to clear right back with a stale
    // preview.
    ++previewRequestId;
    // No request is (or will be) in flight for empty content — without
    // this, the skeleton's `is-visible` starting state in the static markup
    // (or a loading state left over from a prior non-empty edit) never gets
    // cleared, so it sits there spinning forever with nothing behind it.
    setPreviewLoading(false);
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      previewBlobUrl = null;
    }
    frame.removeAttribute('src');
    return;
  }

  const engine = getTemplateEngine();
  const isBanded = engine === 'banded';
  let requestBody;
  if (isBanded) {
    const parsed = tryParseMockData();
    const errEl = document.getElementById('templateMockDataError');
    if (errEl) {
      errEl.textContent = parsed.ok ? '' : `Mock Data ไม่ใช่ JSON ที่ถูกต้อง: ${parsed.message}`;
      errEl.classList.toggle('hidden', parsed.ok);
    }
    if (!parsed.ok) return; // leave the last good preview up, error shown inline
    requestBody = {
      html_content: rawHtml,
      paper_size: document.getElementById('frmTemplatePaperSize')?.value || 'A4',
      orientation: document.getElementById('frmTemplateOrientation')?.value || 'portrait',
      template_engine: 'banded',
      params: parsed.value,
      js_content: jsEditor?.getValue().trim() || undefined,
    };
  } else {
    requestBody = {
      html_content: substituteParameters(rawHtml, currentParameters),
      paper_size: document.getElementById('frmTemplatePaperSize')?.value || 'A4',
      orientation: document.getElementById('frmTemplateOrientation')?.value || 'portrait',
    };
  }

  const requestId = ++previewRequestId;
  setPreviewLoading(true);
  try {
    const blob = await reportPostBlob('/print-templates/preview', requestBody);
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
        <button type="button" class="p-btn p-btn-ghost p-btn-ghost-danger p-btn-sm" onclick="removePrintTemplateParameterRow(${i})" title="ลบ">
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

// ── Page tabs (รายละเอียด / รายงาน) ──────────────────────────────────────

/** Slides `.um-page-tab-indicator` under whichever `.um-page-tab` is
 * currently `.active` — reads real layout (offsetLeft/offsetWidth), so it
 * has to run after the active class is already set, and again on resize
 * since the tab row's width (and so each button's offsetLeft) changes with
 * viewport width. No-ops quietly if the indicator/tabs aren't on the page
 * (or a panel is still `hidden` and so has zero layout) rather than
 * throwing — this is also called speculatively from initPrintTemplateForm
 * before the first paint has necessarily settled. */
export function positionPrintTemplateTabIndicator() {
  const tabs = document.querySelector('.um-page-tabs');
  const indicator = tabs?.querySelector('.um-page-tab-indicator');
  const activeTab = tabs?.querySelector('.um-page-tab.active');
  if (!tabs || !indicator || !activeTab) return;
  indicator.style.width = `${activeTab.offsetWidth}px`;
  indicator.style.transform = `translateX(${activeTab.offsetLeft}px)`;
}

/** Switches the page's top-level tab. Plain class toggles on the button
 * (`.active`) and its panel (`.hidden`) — no other state to keep in sync,
 * except sliding the shared indicator bar to match. */
export function switchPrintTemplateTab(tabName) {
  document.querySelectorAll('.um-page-tab').forEach((btn) => {
    const isActive = btn.dataset.tab === tabName;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });
  document.querySelectorAll('[data-tab-panel]').forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.tabPanel !== tabName);
  });
  positionPrintTemplateTabIndicator();
}

// ── View mode (split / code / preview) — up to 3 columns: HTML | Paginator
// JavaScript (banded engine only) | Preview. Pane/resizer visibility and
// sizing both live here rather than in CSS, because which panes exist
// depends on two independent toggles at once — the view-mode buttons below
// AND the engine select (see updateTemplateEngineSectionVisibility) — and a
// plain CSS mode class can't express "visible in code mode, but only when
// banded". ──────────────────────────────────────────────────────────────

const PANE_MIN_PCT = 20;
const PANE_MAX_PCT = 80;
let currentViewMode = 'split';
let lastHtmlPct = null;
let lastJsPct = null;

export function setPrintTemplateViewMode(mode) {
  currentViewMode = mode;
  document.querySelectorAll('.um-view-toggle-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.viewMode === mode);
  });
  layoutEditorPanes();
}

/** Recomputes which of the (up to) 3 panes are visible for the current view
 * mode + engine, and assigns flex so every visible pane but the last one
 * keeps an explicit %-basis (last-dragged, or a sane default) while the
 * last one grows to fill whatever's left — same shape as the original
 * 2-column split, generalized to however many panes are visible right now. */
function layoutEditorPanes() {
  const htmlPane = document.getElementById('templateEditorPane');
  const jsPane = document.getElementById('templateJsPane');
  const previewPane = document.getElementById('templatePreviewPane');
  const htmlJsResizer = document.getElementById('templateEditorResizer');
  const jsPreviewResizer = document.getElementById('templateJsResizer');
  if (!htmlPane || !jsPane || !previewPane) return;

  const isBanded = getTemplateEngine() === 'banded';
  const showHtml = currentViewMode !== 'preview';
  const showJs = isBanded && currentViewMode !== 'preview';
  const showPreview = currentViewMode !== 'code';

  htmlPane.classList.toggle('hidden', !showHtml);
  jsPane.classList.toggle('hidden', !showJs);
  previewPane.classList.toggle('hidden', !showPreview);
  htmlJsResizer?.classList.toggle('hidden', !(showHtml && (showJs || showPreview)));
  jsPreviewResizer?.classList.toggle('hidden', !(showJs && showPreview));

  const visiblePanes = [
    showHtml && { el: htmlPane, pct: lastHtmlPct ?? 40 },
    showJs && { el: jsPane, pct: lastJsPct ?? 30 },
    showPreview && { el: previewPane, pct: null },
  ].filter(Boolean);

  visiblePanes.forEach((pane, i) => {
    const isLast = i === visiblePanes.length - 1;
    pane.el.style.flex = isLast ? '1 1 0%' : `0 0 ${pane.pct}%`;
  });
}

// ── Resizable split — drag a resizer to reallocate width between the pane
// immediately to its left and whatever's left of the row. Both resizers
// share the same drag mechanics via initPaneResizer(). ─────────────────

/** @param {{ resizerId: string, paneId: string, onResize: (pct: number) => void }} config */
function initPaneResizer({ resizerId, paneId, onResize }) {
  const resizer = document.getElementById(resizerId);
  const split = document.getElementById('templateEditorSplit');
  const pane = document.getElementById(paneId);
  if (!resizer || !split || !pane) return;

  let activePointerId = null;
  let rafId = null;
  let pendingClientX = null;

  function setPanePct(pct) {
    const clamped = Math.min(PANE_MAX_PCT, Math.max(PANE_MIN_PCT, pct));
    onResize(clamped);
    pane.style.flex = `0 0 ${clamped}%`;
  }

  function applyClientX(clientX) {
    // Measured from this pane's own left edge (not the split container's) —
    // the boundary a resizer controls is always immediately to its own
    // pane's right, so this math is correct regardless of how many panes
    // come before it.
    const paneRect = pane.getBoundingClientRect();
    const splitRect = split.getBoundingClientRect();
    setPanePct(((clientX - paneRect.left) / splitRect.width) * 100);
  }

  // rAF-throttled: CodeMirror re-lays-out its whole viewport on every resize
  // of its mount, so applying the raw flex on every single pointermove
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
    const paneRect = pane.getBoundingClientRect();
    const splitRect = split.getBoundingClientRect();
    const currentPct = (paneRect.width / splitRect.width) * 100;
    if (event.key === 'ArrowLeft') setPanePct(currentPct - 2);
    else if (event.key === 'ArrowRight') setPanePct(currentPct + 2);
    else return;
    event.preventDefault();
  });
}

function initSplitResizers() {
  initPaneResizer({
    resizerId: 'templateEditorResizer',
    paneId: 'templateEditorPane',
    onResize: (pct) => {
      lastHtmlPct = pct;
    },
  });
  initPaneResizer({
    resizerId: 'templateJsResizer',
    paneId: 'templateJsPane',
    onResize: (pct) => {
      lastJsPct = pct;
    },
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

function exitMockDataFullscreenOnEscape(event) {
  if (event.key === 'Escape' && isMockDataFullscreen) toggleMockDataFullscreen();
}

/** Same fullscreen mechanism as the HTML editor, applied to
 * #templateMockDataSection directly — that section has no split/preview
 * pane to expand alongside, just the one JSON editor mount (see
 * .um-editor-fullscreen .um-mockdata-editor-mount in layout.css). */
export function toggleMockDataFullscreen() {
  const section = document.getElementById('templateMockDataSection');
  const btn = document.getElementById('templateMockDataFullscreenBtn');
  if (!section || !btn) return;

  isMockDataFullscreen = !isMockDataFullscreen;
  section.classList.toggle('um-editor-fullscreen', isMockDataFullscreen);
  btn.innerHTML = isMockDataFullscreen
    ? '<i data-lucide="minimize" class="um-icon-sm"></i> Exit Fullscreen'
    : '<i data-lucide="maximize" class="um-icon-sm"></i> Fullscreen';
  refreshIcons();

  if (isMockDataFullscreen) {
    document.addEventListener('keydown', exitMockDataFullscreenOnEscape);
  } else {
    document.removeEventListener('keydown', exitMockDataFullscreenOnEscape);
  }
}

/** Collapses/expands the Mock Data body (editor + inline error) under its
 * section header — independent of `#templateMockDataSection`'s own
 * `hidden` class, which instead tracks the simple/banded engine toggle
 * (see updateTemplateEngineSectionVisibility). `aria-expanded` on the
 * header button is both the a11y state and what layout.css keys the
 * chevron-rotation CSS off of, so it's the only state kept — no separate
 * boolean variable to drift out of sync with it. */
export function toggleMockDataCollapse() {
  const btn = document.getElementById('templateMockDataCollapseBtn');
  const body = document.getElementById('templateMockDataBody');
  if (!btn || !body) return;

  const isExpanded = btn.getAttribute('aria-expanded') === 'true';
  btn.setAttribute('aria-expanded', String(!isExpanded));
  body.classList.toggle('hidden', isExpanded);
}

export function formatPrintTemplateMockData() {
  if (mockDataEditor?.format()) {
    document.getElementById('templateMockDataError')?.classList.add('hidden');
  } else {
    showToast('Mock Data ไม่ใช่ JSON ที่ถูกต้อง จัดรูปแบบไม่ได้', 'error');
  }
}

// ── Form init / submit ──────────────────────────────────────────────────

function getTemplateEngine() {
  return document.getElementById('frmTemplateEngine')?.value || 'simple';
}

/** Pasting a JSON code block copied out of a chat/doc very commonly drags
 * the ```json / ``` fence lines along with it — strip them instead of
 * making every admin re-copy without them (this is the #1 real-world cause
 * of "valid JSON followed by unexpected trailing characters" errors here). */
function stripCodeFence(text) {
  return text
    .replace(/^\s*```[a-zA-Z]*\s*\n?/, '')
    .replace(/\n?\s*```\s*$/, '')
    .trim();
}

/** JSON.parse only reports a character offset — on a multi-hundred-line
 * textarea that's nearly impossible to locate by eye, so pull a short
 * snippet of the actual text around it into the error instead. */
function describeJsonErrorPosition(text, error) {
  const match = /position (\d+)/.exec(error.message);
  if (!match) return '';
  const pos = Number(match[1]);
  const before = text.slice(Math.max(0, pos - 20), pos);
  const after = text.slice(pos, Math.min(text.length, pos + 20));
  return ` — บริเวณ: "…${before}👉${after}…"`;
}

/** Non-throwing — used by updatePreview() so a keystroke leaving invalid
 * JSON just shows the inline error and skips the render instead of
 * spamming a toast on every debounced tick. */
function tryParseMockData() {
  const raw = stripCodeFence(mockDataEditor?.getValue() ?? '');
  if (!raw) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (error) {
    return { ok: false, message: `${error.message}${describeJsonErrorPosition(raw, error)}` };
  }
}

/** Throwing wrapper for the save/generate-test-pdf paths — those are
 * deliberate clicks, so surfacing the problem via the normal error toast
 * (see handlePrintTemplateFormSubmit/generatePrintTemplateTestPdf) fits. */
function parseMockDataOrThrow() {
  const result = tryParseMockData();
  if (!result.ok) {
    throw new Error(`Mock Data ไม่ใช่ JSON ที่ถูกต้อง: ${result.message}`);
  }
  return result.value;
}

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
    template_engine: getTemplateEngine(),
    // Only meaningful for 'banded' (see updateTemplateEngineSectionVisibility) —
    // 'simple' always sends null, clearing any leftover override from before
    // the admin switched engines. Empty editor content also means "use the
    // shared paginator", same as never having set one.
    js_content: getTemplateEngine() === 'banded' ? jsEditor.getValue().trim() || null : null,
    mock_data: parseMockDataOrThrow(),
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

/** 'banded' has no use for the flat parameters[] editor (its placeholders
 * are dotted paths into a nested object, not standalone {{key}}s) — swap
 * that section for the Mock Data JSON textarea instead, and reveal the
 * Paginator JavaScript column in the HTML editor split (see
 * layoutEditorPanes()). */
function updateTemplateEngineSectionVisibility() {
  const isBanded = getTemplateEngine() === 'banded';
  document.getElementById('templateParametersSection')?.classList.toggle('hidden', isBanded);
  document.getElementById('templateMockDataSection')?.classList.toggle('hidden', !isBanded);
  layoutEditorPanes();
}

export async function initPrintTemplateForm() {
  const form = document.getElementById('printTemplateForm');
  if (!form) return;

  const templateId = document.getElementById('view-print-template-form').dataset.printTemplateId || null;
  form.dataset.editingId = templateId ?? '';
  document.getElementById('printTemplateGeneratePdfBtn')?.classList.toggle('hidden', !templateId);

  // The "รายละเอียด" tab (which holds the required code/name fields) can be
  // the *inactive*, `hidden`-classed one when editing (see form.ejs) — a
  // required field inside a `display:none` panel can't be focused, and
  // Chrome throws "An invalid form control is not focusable" when native
  // validation tries to report on it, silently breaking the Save button.
  // Switch to whichever tab actually holds the invalid field before that
  // happens: the `invalid` event doesn't bubble but does reach a capturing
  // listener on the form, and fires before the browser attempts to focus it.
  form.addEventListener(
    'invalid',
    (event) => {
      const panel = event.target.closest('[data-tab-panel]');
      if (panel) switchPrintTemplateTab(panel.dataset.tabPanel);
    },
    true,
  );

  htmlEditor = createHtmlEditor({
    mountEl: document.getElementById('templateHtmlEditorMount'),
    initialDoc: '',
    // Preview now round-trips through Gotenberg (see updatePreview) instead
    // of an instant srcdoc render — a longer debounce avoids firing a real
    // PDF conversion on every keystroke.
    onChange: debounce(updatePreview, 900),
  });
  mockDataEditor = createJsonEditor({
    mountEl: document.getElementById('templateMockDataEditorMount'),
    initialDoc: '{}',
    onChange: debounce(updatePreview, 900),
  });
  jsEditor = createJavascriptEditor({
    mountEl: document.getElementById('templateJsEditorMount'),
    initialDoc: '',
    onChange: debounce(updatePreview, 900),
  });

  document.getElementById('frmTemplatePaperSize')?.addEventListener('change', updatePreview);
  document.getElementById('frmTemplateOrientation')?.addEventListener('change', updatePreview);
  document.getElementById('frmTemplateEngine')?.addEventListener('change', () => {
    updateTemplateEngineSectionVisibility();
    updatePreview();
  });
  initSplitResizers();

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
      document.getElementById('frmTemplateEngine').value = template.template_engine ?? 'simple';
      mockDataEditor.setValue(JSON.stringify(template.mock_data ?? {}, null, 2));
      currentParameters = (template.parameters ?? []).map((p) => ({
        key: p.key,
        label_th: p.label?.th ?? '',
        label_en: p.label?.en ?? '',
        default_value: p.default_value ?? '',
        _test_value: p.default_value ?? '',
      }));
      htmlEditor.setValue(template.html_content ?? '');
      jsEditor.setValue(template.js_content ?? '');
    } catch (error) {
      showApiError(error, 'โหลดข้อมูลเทมเพลตไม่สำเร็จ');
    }
  }

  updateTemplateEngineSectionVisibility();

  renderParametersRows();
  updatePreview();

  // Initial indicator placement under whichever tab form.ejs pre-marked
  // .active (details when creating, report when editing) — then keep it
  // aligned if the tab row's width changes (each button's offsetLeft shifts
  // with it). switchPrintTemplateTab already repositions it on every click.
  positionPrintTemplateTabIndicator();
  window.addEventListener('resize', positionPrintTemplateTabIndicator);
}

export async function handlePrintTemplateFormSubmit(event) {
  event.preventDefault();
  const editingId = event.target.dataset.editingId || null;

  try {
    const payload = buildPrintTemplatePayload(); // throws on invalid Mock Data JSON
    if (!payload.html_content.trim()) {
      showToast('กรุณากรอกเนื้อหา HTML', 'error');
      setPrintTemplateViewMode('code');
      return;
    }

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

/** 'simple' test data still comes from parameters[]._test_value (unchanged);
 * 'banded' has no flat parameters to draw from, so it uses the Mock Data
 * JSON textarea (payload.mock_data) as params instead. */
function buildSimpleTestParams() {
  const testParams = {};
  currentParameters.forEach((p) => {
    if (p.key.trim()) testParams[p.key.trim()] = p._test_value ?? p.default_value ?? '';
  });
  return testParams;
}

export async function generatePrintTemplateTestPdf() {
  const form = document.getElementById('printTemplateForm');
  const editingId = form?.dataset.editingId;
  if (!editingId) return;

  try {
    const payload = buildPrintTemplatePayload(); // throws on invalid Mock Data JSON
    if (!payload.html_content.trim()) {
      showToast('กรุณากรอกเนื้อหา HTML', 'error');
      return;
    }

    const params = payload.template_engine === 'banded' ? payload.mock_data : buildSimpleTestParams();

    // Save first — render() reads the persisted object from storage, so a
    // stale save would produce a PDF that doesn't match what's in the editor.
    await reportPut(`/print-templates/${editingId}`, payload);
    const result = await reportPost(`/print-templates/${editingId}/render`, { params });
    window.open(result.url, '_blank', 'noopener');
  } catch (error) {
    showApiError(error, 'สร้าง PDF ทดสอบไม่สำเร็จ');
  }
}

// ── Delete ───────────────────────────────────────────────────────────────

export function confirmDeletePrintTemplate(templateId, code) {
  return confirmAndRun({
    title: 'ลบเทมเพลต',
    message: `ยืนยันการลบเทมเพลต "${code}"?`,
    action: () => reportDelete(`/print-templates/${templateId}`),
    successMessage: 'ลบเทมเพลตสำเร็จ',
    errorMessage: 'ลบเทมเพลตไม่สำเร็จ',
    onSuccess: () => loadPrintTemplates(pager.getCurrentPage()),
  });
}
