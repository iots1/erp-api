// Dark-mode toggle. The saved preference is applied synchronously before
// first paint by the inline script in components/layout/page-head.ejs (see
// there for why) — this module only handles the interactive toggle + the
// sidebar switch state.
const STORAGE_KEY = 'iam-theme';

function systemPrefersDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') || (systemPrefersDark() ? 'dark' : 'light');
}

function applyThemeIcon(theme) {
  const toggle = document.getElementById('themeToggleSwitch');
  if (!toggle) return;
  toggle.checked = theme === 'dark';
}

/** Called once on page boot so the sidebar switch matches whatever theme was
 * already applied (by the FOUC-prevention script or the system default). */
export function initThemeIcon() {
  applyThemeIcon(currentTheme());
}

/** Bridged to window — bound to the sidebar toggle switch's onchange. */
export function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(STORAGE_KEY, next);
  applyThemeIcon(next);
}
