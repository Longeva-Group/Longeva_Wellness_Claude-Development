/* Vaccine Finder, Phase 1 (Brief v4 Section 18).
   Reads the destination data island rendered by longeva-vaccine-finder.liquid
   and renders an in-place result panel when a destination is chosen.
   Vanilla JS, no dependencies. Results are built with DOM methods, not
   innerHTML, so admin-entered text cannot inject markup. */
(function () {
  'use strict';

  function init(root) {
    var dataEl = root.querySelector('#longeva-vfinder-data');
    var select = root.querySelector('#longeva-vfinder-select');
    var out = root.querySelector('#longeva-vfinder-results');
    var nojs = root.querySelector('[data-nojs]');
    if (!dataEl || !select || !out) return;

    var list;
    try {
      list = JSON.parse(dataEl.textContent || '[]');
    } catch (e) {
      return; // leave the server-rendered fallback in place
    }
    if (!Array.isArray(list) || !list.length) return;

    // JS is running, so the no-JS link list is redundant.
    if (nojs) nojs.hidden = true;

    // Key on the unique metaobject handle, never the display name: two
    // destinations can share a country string, and that would mis-route a
    // traveller to the wrong vaccine list.
    var byHandle = {};
    list.forEach(function (d) { if (d && d.handle) byHandle[d.handle] = d; });

    var bookUrl = root.getAttribute('data-book-url') || '/pages/book';
    var bookLabel = root.getAttribute('data-book-label') || 'Book a consultation';
    var emptyMsg = root.getAttribute('data-empty-msg') || 'Please contact us to plan your trip.';
    var consultNote = root.getAttribute('data-consult-note') || '';
    var yfNote = root.getAttribute('data-yf-note') || '';

    function el(tag, className, text) {
      var n = document.createElement(tag);
      if (className) n.className = className;
      if (text != null) n.textContent = text;
      return n;
    }

    // Only http(s) or root-relative URLs may reach an href, so an admin
    // string can never become a javascript: execution vector.
    function safeHref(u) {
      return (typeof u === 'string' && /^(https?:|\/)/i.test(u)) ? u : null;
    }

    function render(d) {
      out.textContent = '';
      if (!d) { out.hidden = true; return; }

      // Reveal the live region before injecting content, so assistive tech
      // observes the mutation on a rendered node and announces the result.
      out.hidden = false;

      var card = el('div', 'longeva-vfinder__card');
      card.appendChild(el('h3', 'longeva-vfinder__card-title', 'Travel vaccinations for ' + d.name));

      // Risk summary leads: the worried traveller's first question is "what
      // is the risk where I am going", which frames why the vaccines matter.
      if (d.risk) {
        var riskWrap = el('div', 'longeva-vfinder__risk');
        riskWrap.appendChild(el('p', 'longeva-vfinder__card-label', 'Travel health risks'));
        riskWrap.appendChild(el('p', 'longeva-vfinder__risk-text', d.risk));
        card.appendChild(riskWrap);
      }

      // Recommended vaccines, or a route-to-consultation message when none set.
      var vacWrap = el('div', 'longeva-vfinder__vaccines');
      if (d.vaccines && d.vaccines.length) {
        vacWrap.appendChild(el('p', 'longeva-vfinder__card-label', 'Vaccines we usually recommend'));
        var ul = el('ul', 'longeva-vfinder__vaccine-list');
        d.vaccines.forEach(function (v) {
          if (!v || !v.name) return;
          var li = el('li', 'longeva-vfinder__vaccine');
          var href = safeHref(v.url);
          if (href) {
            var a = el('a', 'longeva-vfinder__vaccine-link', v.name);
            a.href = href;
            li.appendChild(a);
          } else {
            li.appendChild(el('span', null, v.name));
          }
          ul.appendChild(li);
        });
        vacWrap.appendChild(ul);
        if (consultNote) vacWrap.appendChild(el('p', 'longeva-vfinder__note', consultNote));
      } else {
        vacWrap.appendChild(el('p', 'longeva-vfinder__empty', emptyMsg));
      }
      card.appendChild(vacWrap);

      // Yellow fever flag.
      if (d.yf && yfNote) {
        card.appendChild(el('p', 'longeva-vfinder__yf', yfNote));
      }

      // Actions: full guide + book.
      var actions = el('div', 'longeva-vfinder__actions');
      var guideHref = safeHref(d.url);
      if (guideHref) {
        var guide = el('a', 'longeva-btn longeva-btn--ghost', 'Read the full ' + d.name + ' guide');
        guide.href = guideHref;
        actions.appendChild(guide);
      }
      var book = el('a', 'longeva-btn longeva-btn--primary-on-light', bookLabel);
      book.href = safeHref(bookUrl) || '/pages/book';
      actions.appendChild(book);
      card.appendChild(actions);

      out.appendChild(card);
    }

    select.addEventListener('change', function () {
      var d = byHandle[select.value] || null;
      render(d);
      // Bring the result into view on selection, so a mobile user sees the
      // panel rather than assuming nothing happened. Selection only, never
      // the restore path below (which would jump the page on load).
      if (d && out.scrollIntoView) {
        out.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    // If the browser restored a prior selection (bfcache, autofill), reflect
    // it without scrolling.
    if (select.value) render(byHandle[select.value] || null);
  }

  function boot() {
    var roots = document.querySelectorAll('.longeva-vfinder');
    for (var i = 0; i < roots.length; i++) init(roots[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
