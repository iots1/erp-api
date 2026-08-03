// One entry point for every admin page's controller. Each page's controller
// used to hand-roll the same four things — bridge the shell's globals onto
// `window`, wire the toolbar filters, wire the sortable table header, then
// branch between the list page and the form page — differing only in element
// ids and which service functions to call. That copy-per-page shape is what
// this replaces: a new page now supplies a config object instead of a
// near-identical 70-line file, and a fix to the wiring lands everywhere at
// once instead of needing twelve edits.
import { handleAuthLogin } from '../../../js/auth-guard.service.js';
import { handleChangePasswordSubmit } from '../../../js/change-password.service.js';
import { toggleTheme } from '../../../js/theme.service.js';
import { bootAdminPage, handleInitialLoginSubmit, handleLogout } from './shell.service.js';
import { createSortableTable } from './sortable-table.js';
import { debounce } from './utils.js';

/** Matches the delay every page's search box already used. */
const SEARCH_DEBOUNCE_MS = 350;

/**
 * Globals the admin shell itself needs on every page, regardless of resource:
 * the login/re-auth modal (auth-modal.ejs), the change-password modal and the
 * logout button (page-foot.ejs / sidebar.ejs), and the theme switch. Because
 * these live in shared components rendered on *every* page, every page has to
 * bridge *all* of them — policies previously missed handleChangePasswordSubmit,
 * so submitting that modal there threw a ReferenceError. Assigning them from
 * one place makes that class of omission impossible.
 */
const SHELL_GLOBALS = {
  handleAuthLogin,
  handleChangePasswordSubmit,
  handleInitialLoginSubmit,
  handleLogout,
  toggleTheme,
};

/**
 * @typedef {object} FilterConfig
 * @property {string} id  Element id of the input/select.
 * @property {(value: string) => void} onChange  Receives the element's value.
 * @property {'input'|'change'} [event]  Defaults to 'input' (a text box).
 *   'input' is debounced; 'change' (a <select>) fires immediately, since
 *   picking an option is already a deliberate, discrete action.
 */

/**
 * @param {object} config
 * @param {string} config.pagePermission  e.g. 'page:view_users'.
 * @param {object} [config.globals]  Page-specific window bridges, merged over
 *   SHELL_GLOBALS.
 * @param {{ detectId: string, init: () => any, wire?: () => void }} [config.form]
 *   For a resource whose create/edit form ships in the same bundle as its list
 *   page (both render from one entry.js). `detectId` is an id present only in
 *   form.ejs — how the bundle tells which of the two pages it landed on.
 *   `wire` is an optional hook for form-only listeners that must be attached
 *   synchronously, before the (async, auth-gated) boot — the policy form uses
 *   it for its code-prefix input mask and its click-outside dropdown closer.
 * @param {() => any} [config.load]  Loader for the non-form page. Omit for a
 *   page with no data to fetch (system-setting).
 * @param {FilterConfig[]} [config.filters]
 * @param {{ id: string, set: (v: string) => void }} [config.pageSize]
 * @param {{ tableId: string, defaultSort: string, set: (s: string) => void }} [config.sort]
 */
export function createAdminPage({
  pagePermission,
  globals,
  form,
  load,
  filters,
  pageSize,
  sort,
}) {
  Object.assign(window, SHELL_GLOBALS, globals);

  // A resource with a form renders form.ejs and index.ejs from the same
  // bundle, so which one is live is decided by which markup actually exists.
  // The form page has no table, hence no filter/sort wiring.
  if (form && document.getElementById(form.detectId)) {
    form.wire?.();
    bootAdminPage({ pagePermission, loader: () => form.init() });
    return;
  }

  wireFilters(filters, pageSize);
  wireSort(sort);
  bootAdminPage({ pagePermission, loader: load });
}

function wireFilters(filters = [], pageSize) {
  for (const { id, onChange, event = 'input' } of filters) {
    const el = document.getElementById(id);
    if (!el) continue;
    const handler = (e) => onChange(e.target.value);
    el.addEventListener(
      event,
      event === 'input' ? debounce(handler, SEARCH_DEBOUNCE_MS) : handler,
    );
  }

  if (pageSize) {
    document
      .getElementById(pageSize.id)
      ?.addEventListener('change', (e) => pageSize.set(e.target.value));
  }
}

function wireSort(sort) {
  if (!sort) return;
  createSortableTable({
    container: document.querySelector(`#${sort.tableId} thead`),
    defaultSort: sort.defaultSort,
    onChange: sort.set,
  });
}
