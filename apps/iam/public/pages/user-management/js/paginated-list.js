// Generic page/page-size bookkeeping + pager DOM sync for a list wired to
// components/ui/pager.ejs (infoId/prevId/nextId). Every resource module
// (users, permissions, sessions, ...) was re-implementing this exact
// currentPage/pageSize/goToXPage/renderXPager quartet — this factory is the
// single place that owns it (SRP), so a resource module only supplies *how*
// to fetch one page (DIP: this file depends on the fetchPage abstraction,
// never on a concrete resource) and new lists can adopt it without changing
// this file (OCP).
export function createPaginatedList({ fetchPage, infoId, prevId, nextId, defaultPageSize = 20 }) {
  let currentPage = 1;
  let pageSize = defaultPageSize;
  let pagination = null;

  function renderPager() {
    const info = document.getElementById(infoId);
    const prevBtn = document.getElementById(prevId);
    const nextBtn = document.getElementById(nextId);
    if (!info || !pagination) return;

    info.textContent = `หน้า ${pagination.page} / ${pagination.total_pages} (ทั้งหมด ${pagination.total_records} รายการ)`;
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= pagination.total_pages;
  }

  async function load(page = 1) {
    currentPage = page;
    // fetchPage handles/reports its own errors and returns undefined on
    // failure — keep showing the last known pagination rather than clobber
    // it, matching how each resource module behaved before this refactor.
    const result = await fetchPage(page, pageSize);
    if (result !== undefined) pagination = result;
    renderPager();
  }

  function setPageSize(size) {
    pageSize = Number(size) || defaultPageSize;
    return load(1);
  }

  function goToPage(direction) {
    const nextPage = currentPage + direction;
    if (nextPage < 1) return undefined;
    if (pagination && nextPage > pagination.total_pages) return undefined;
    return load(nextPage);
  }

  return {
    load,
    setPageSize,
    goToPage,
    getCurrentPage: () => currentPage,
    getPageSize: () => pageSize,
  };
}
