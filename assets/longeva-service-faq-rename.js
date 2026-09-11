// Service pages: rename the page-body FAQ heading to 'Treatment FAQs'.
//
// Why: each service page body (admin-edited HTML rendered via
// {{ page.content }}) carries an <h2>Frequently asked questions</h2>
// before the treatment-specific FAQ list. The theme also renders a
// second FAQ section (longeva-service-layout.liquid:303-331) which
// is now labelled 'General FAQs'. Anthony asked the two be
// differentiated. This script relabels the page-body heading
// client-side so we avoid 69 admin pageUpdate mutations against
// production.
//
// Scope: limited to .longeva-service-page__body (the {{ page.content }}
// wrapper) so the theme's General FAQs heading is unaffected.

(function () {
  function rename() {
    var body = document.querySelector('.longeva-service-page__body');
    if (!body) return;
    var headings = body.querySelectorAll('h1, h2, h3');
    for (var i = 0; i < headings.length; i++) {
      var h = headings[i];
      if ((h.textContent || '').trim().toLowerCase() === 'frequently asked questions') {
        h.textContent = 'Treatment FAQs';
        return;
      }
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', rename);
  } else {
    rename();
  }
})();
