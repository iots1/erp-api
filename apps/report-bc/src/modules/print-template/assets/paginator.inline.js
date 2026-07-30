/* Banded report paginator — injected into a 'banded' template's html_content
 * and run in Gotenberg's own Chromium before the PDF snapshot is taken.
 * Reads <template data-band="..."> blocks the template author declared,
 * measures real row heights, and splits the report into physical pages
 * itself (thead repetition, filler rows, last-page summary/footer variant).
 *
 * See reviews/print-template-pagination-2026-07-29.md for the architecture
 * and the two bugs this implementation had to work around:
 *  - `table{height:100%}` inside a flex-grow container silently mismeasures
 *    (§3.4) — this is why band containers below get a hard px height +
 *    overflow:hidden instead, checked via scrollHeight > clientHeight.
 *  - web fonts (even base64-embedded @font-face) still decode async — every
 *    height measurement here must happen after `document.fonts.ready`.
 *
 * Template authoring contract (band names the code below looks up by):
 *   page-header, detail-header, detail-row, detail-extra (optional),
 *   filler-row, summary (optional), page-footer[data-when=continuation|last]
 * `<template data-repeat="key">...{{row.field}}...</template>` inside any
 * band loops over `key` in the render data (nested paths allowed, e.g.
 * `{{seller.name}}`). System variables: __page, __pages, __next_page,
 * __row_no.
 *
 * Deliberately framework-free (no bundler, no external deps) — this file is
 * inlined into the HTML sent to Gotenberg as-is; see BandedRenderService.
 */
(async function () {
  'use strict';
  await document.fonts.ready;

  var D = window.__RP_DATA__ || {};

  // ── tiny template engine: {{path}} + <template data-repeat> loops ──────
  function resolvePath(path, scope) {
    var parts = path.split('.');
    var cur = scope;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return null;
      cur = cur[parts[i]];
    }
    return cur;
  }
  function escapeHtml(v) {
    return String(v).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function renderBand(html, scope) {
    html = html.replace(
      /<template data-repeat="([\w.]+)">([\s\S]*?)<\/template>/g,
      function (_match, key, inner) {
        var items = resolvePath(key, scope) || [];
        var out = '';
        for (var i = 0; i < items.length; i++) {
          var itemScope = {};
          for (var k in scope) itemScope[k] = scope[k];
          itemScope.row = items[i];
          itemScope.__row_no = i + 1;
          out += renderBand(inner, itemScope);
        }
        return out;
      },
    );
    return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, function (_match, path) {
      if (path === '__pages') return '<span data-rp-pages></span>';
      var value = resolvePath(path, scope);
      return value == null ? '' : escapeHtml(value);
    });
  }

  // ── read every declared band ────────────────────────────────────────
  var bands = {};
  Array.prototype.forEach.call(
    document.querySelectorAll('template[data-band]'),
    function (t) {
      var name = t.getAttribute('data-band');
      var when = t.getAttribute('data-when');
      bands[when ? name + ':' + when : name] = t.innerHTML;
    },
  );

  var body = document.body;
  var pages = [];

  function newPage() {
    var page = document.createElement('div');
    page.className = 'a4-page rp-page';
    // Structural layout for the internal bands is injected inline here
    // rather than relying on the template's own utility classes (e.g.
    // Tailwind-style `flex-grow`) — keeps the engine working for any
    // template that only defines `.a4-page` (physical page: size, padding,
    // page-break) and leaves band-internal layout to the paginator.
    page.style.cssText = 'display:flex;flex-direction:column;';
    page.innerHTML =
      '<div class="rp-hdr"></div>' +
      '<div class="rp-detail" style="flex:1 1 auto;display:flex;flex-direction:column;min-height:0">' +
      '<div class="rp-box" style="overflow:hidden">' +
      '<table class="table-items" style="width:100%"><thead></thead><tbody></tbody></table>' +
      '</div></div>' +
      '<div class="rp-sum"></div>' +
      '<div class="rp-ftr"></div>';
    body.appendChild(page);

    var scope = {};
    for (var k in D) scope[k] = D[k];
    scope.__page = pages.length + 1;
    scope.__next_page = pages.length + 2;

    page.querySelector('.rp-hdr').innerHTML = renderBand(bands['page-header'] || '', scope);
    page.querySelector('thead').innerHTML = renderBand(bands['detail-header'] || '', scope);
    // Render the continuation footer first to reserve its real height in
    // the flex layout before .rp-box gets its px budget below — PASS 4
    // swaps in the last-page variant afterwards for whichever page ends up
    // being the actual last one.
    page.querySelector('.rp-ftr').innerHTML = renderBand(
      bands['page-footer:continuation'] || '',
      scope,
    );

    var detail = page.querySelector('.rp-detail');
    var box = page.querySelector('.rp-box');
    // Lock the space flex-grow allocated to .rp-detail as a hard px height
    // + overflow:hidden — see the file header docblock for why this can't
    // be `table{height:100%}` inside the flex-grow container instead.
    box.style.height = detail.clientHeight + 'px';

    var record = {
      el: page,
      tbody: page.querySelector('tbody'),
      detail: detail,
      box: box,
      sum: page.querySelector('.rp-sum'),
      scope: scope,
    };
    pages.push(record);
    return record;
  }

  function appendRows(tbody, html) {
    var tmp = document.createElement('tbody');
    tmp.innerHTML = html;
    var added = [];
    while (tmp.firstChild) added.push(tbody.appendChild(tmp.firstChild));
    return added;
  }
  function removeNodes(nodes) {
    nodes.forEach(function (n) {
      if (n.parentNode) n.parentNode.removeChild(n);
    });
  }
  // `scrollHeight` only reports a value *larger* than `clientHeight` once
  // content genuinely overflows a box with an explicit height — while
  // content is still shorter than the box, scrollHeight just clamps to
  // clientHeight (verified empirically; it does NOT report the shorter
  // "real" content height). That makes it a reliable "did the last addition
  // push past capacity" signal — but only for an exact `>` comparison; an
  // earlier attempt at `scrollHeight > clientHeight - 2` (meant to leave the
  // last row's border some breathing room) broke this entirely, since
  // scrollHeight === clientHeight for every non-overflowing addition, so
  // that check was true from the very first filler row.
  function overflows(page) {
    return page.box.scrollHeight > page.box.clientHeight;
  }

  // Filling a box to its *exact* pixel capacity can leave the final row's
  // own 1px bottom border sitting precisely on the overflow:hidden clip
  // edge, which Chromium's print rasterizer can round away. Unlike the
  // scrollHeight/clientHeight pair above (clamped, unusable for a margin),
  // a row's own getBoundingClientRect() always reports its true rendered
  // position, so checking the last real row's bottom edge against the box's
  // bottom edge (with a small margin) gives an accurate "close enough to
  // stop" signal without the clamping problem.
  var FILLER_SAFETY_PX = 2;
  function fillerWouldOverflow(page) {
    if (overflows(page)) return true;
    var lastRow = page.tbody.lastElementChild;
    if (!lastRow) return false;
    var boxBottom = page.box.getBoundingClientRect().bottom;
    var rowBottom = lastRow.getBoundingClientRect().bottom;
    return rowBottom > boxBottom - FILLER_SAFETY_PX;
  }

  // ── PASS 1: lay out detail-row per item, measuring real height ─────────
  var items = D.items || [];
  var current = newPage();
  for (var i = 0; i < items.length; i++) {
    var rowScope = {};
    for (var key in D) rowScope[key] = D[key];
    rowScope.row = items[i];
    rowScope.__row_no = i + 1;
    var added = appendRows(current.tbody, renderBand(bands['detail-row'] || '', rowScope));
    if (overflows(current)) {
      removeNodes(added);
      current = newPage();
      appendRows(current.tbody, renderBand(bands['detail-row'] || '', rowScope));
    }
  }

  // ── PASS 2: optional trailing block (e.g. discount conditions) ─────────
  if (bands['detail-extra']) {
    var extra = appendRows(current.tbody, renderBand(bands['detail-extra'], D));
    if (overflows(current)) {
      removeNodes(extra);
      current = newPage();
      appendRows(current.tbody, renderBand(bands['detail-extra'], D));
    }
  }

  // ── PASS 3: summary — try the last detail page first, else its own page ─
  // A page created here for the summary is otherwise treated exactly like
  // any other page (PASS 4 below still fills its detail box with filler
  // rows) — the Makro reference itself shows a normal fully-ruled empty
  // item table on the summary page, not a collapsed/hidden one, so there's
  // no special-casing needed beyond giving summary its own page when it
  // doesn't fit alongside the last page's rows.
  if (bands['summary']) {
    var last = pages[pages.length - 1];
    last.sum.innerHTML = renderBand(bands['summary'], last.scope);
    var free = last.box.clientHeight - last.box.scrollHeight;
    if (last.sum.offsetHeight > free) {
      last.sum.innerHTML = '';
      var summaryPage = newPage();
      summaryPage.sum.innerHTML = renderBand(bands['summary'], summaryPage.scope);
    }
  }

  // ── PASS 4: filler rows to keep the box visually full + real footer ────
  var total = pages.length;
  pages.forEach(function (page, idx) {
    // Repeat the template's own filler-row band (not a hardcoded column
    // count — a template's item table can have any number of columns) until
    // one more would overflow, so a page with few/no real rows still shows
    // a fully-ruled empty box all the way to the bottom, like every other
    // row (this is what makes an intentionally-empty detail page, e.g. the
    // Makro reference's page 2, look identical to a real one instead of
    // just trailing off into blank space).
    if (bands['filler-row']) {
      var fillerHtml = renderBand(bands['filler-row'], page.scope);
      for (var guard = 0; guard < 500; guard++) {
        var filler = appendRows(page.tbody, fillerHtml);
        if (fillerWouldOverflow(page)) {
          removeNodes(filler);
          break;
        }
      }
    }
    var isLast = idx === total - 1;
    page.el.querySelector('.rp-ftr').innerHTML = renderBand(
      bands[isLast ? 'page-footer:last' : 'page-footer:continuation'] || '',
      page.scope,
    );
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-rp-pages]'), function (el) {
    el.textContent = total;
  });

  window.__RP_PAGE_COUNT = total;
  window.__PAGINATION_DONE = true;
})();
