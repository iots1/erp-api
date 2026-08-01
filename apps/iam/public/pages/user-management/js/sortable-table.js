// Single source of truth for "click a <th> to sort" — every list page
// (permissions, roles, policies, ...) was a candidate for its own ad-hoc
// click handler + arrow-icon bookkeeping; this factory is the one place
// that owns it, mirroring how paginated-list.js centralized pagination.
// A page only supplies *which* <thead> to wire and what its default sort
// is; the click/toggle/icon logic never gets reimplemented per resource.
import { refreshIcons } from './utils.js';

/**
 * @param {object} opts
 * @param {Element|null} opts.container - the <thead> holding sortable <th data-sort="field"> cells.
 * @param {string} [opts.defaultSort] - initial "field:asc|desc", matching the value the page's fetchPage already sends.
 * @param {(sort: string) => void} opts.onChange - called with the new "field:asc|desc" string on every header click.
 */
export function createSortableTable({ container, defaultSort, onChange }) {
  const [initialKey, initialDir] = (defaultSort ?? '').split(':');
  let sortKey = initialKey || null;
  let sortDir = initialDir === 'desc' ? 'desc' : 'asc';

  function headers() {
    return container ? [...container.querySelectorAll('th[data-sort]')] : [];
  }

  function render() {
    for (const th of headers()) {
      const key = th.dataset.sort;
      const active = key === sortKey;
      th.classList.toggle('is-sorted', active);
      th.setAttribute('aria-sort', active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none');

      let icon = th.querySelector('.p-sort-icon');
      if (!icon) {
        icon = document.createElement('i');
        icon.className = 'p-sort-icon um-icon-sm';
        th.appendChild(icon);
      }
      icon.setAttribute(
        'data-lucide',
        active ? (sortDir === 'asc' ? 'chevron-up' : 'chevron-down') : 'chevrons-up-down',
      );
    }
    refreshIcons();
  }

  function handleClick(event) {
    const th = event.target.closest('th[data-sort]');
    if (!th || !container.contains(th)) return;

    const key = th.dataset.sort;
    sortDir = key === sortKey && sortDir === 'asc' ? 'desc' : 'asc';
    sortKey = key;
    render();
    onChange(`${sortKey}:${sortDir}`);
  }

  if (container) {
    for (const th of headers()) th.classList.add('p-th-sortable');
    container.addEventListener('click', handleClick);
  }
  render();

  return {
    getSort: () => (sortKey ? `${sortKey}:${sortDir}` : undefined),
  };
}
