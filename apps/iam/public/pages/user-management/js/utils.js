export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDateTime(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return String(value);
  }
}

export function debounce(fn, delayMs) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}

export function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Re-runs lucide's icon replacement — call after any innerHTML render that adds <i data-lucide>. */
export function refreshIcons() {
  if (window.lucide?.createIcons) window.lucide.createIcons();
}

/**
 * Toggles a topbar action button (e.g. the form "บันทึก" button) into/out of
 * a disabled, spinning-icon loading state. The button's original innerHTML
 * is stashed on the element itself so it can be restored exactly, regardless
 * of how many icon/label markup a given action button carries.
 * @param {HTMLButtonElement | null | undefined} button
 * @param {boolean} isLoading
 */
export function setButtonLoading(button, isLoading) {
  if (!button) return;

  if (isLoading) {
    if (button.dataset.loadingOriginal === undefined) {
      button.dataset.loadingOriginal = button.innerHTML;
    }
    button.disabled = true;
    button.classList.add('is-loading');
    button.innerHTML = '<i data-lucide="loader-2" class="um-icon-sm um-spin"></i><span>กำลังบันทึก...</span>';
    refreshIcons();
    return;
  }

  button.disabled = false;
  button.classList.remove('is-loading');
  if (button.dataset.loadingOriginal !== undefined) {
    button.innerHTML = button.dataset.loadingOriginal;
    delete button.dataset.loadingOriginal;
    refreshIcons();
  }
}
