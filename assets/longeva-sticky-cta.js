// Sticky CTA scroll behaviour (refined 2026-05-09 audit pass):
//
// Hide rules (any one hides the bar):
//   1. Scroll direction down (user reading content)
//   2. Footer is in viewport (do not paint over policy links)
//   3. An in-page Book CTA is in viewport (sticky is redundant)
//
// Show rules (all must be true):
//   - Scroll direction up
//   - Footer not in viewport
//   - No in-page Book CTA in viewport
//
// Anthony 2026-05-09: 'When the Book button is in view on the page,
// the sticky should not show; only when scrolling past it.' This
// applies to both mobile and desktop. The CTA-overlap guard solves
// the desktop awkwardness where a near-empty sticky bar floats next
// to a clearly-visible page CTA.
//
// In-page Book CTA targets (any one in viewport hides sticky):
//   - .longeva-service-page__hero-cta  (hero CTA wrapper)
//   - .longeva-service-page__cta-buttons  (bottom 'Ready to book?' CTA)
//   - .longeva-hub__primary-cta-wrap  (category-hub hero CTA)
//   - .longeva-hub__final-cta  (category-hub bottom CTA)
//
// Targets sticky bars on the service-page layout and the category-hub.
//
// Init pattern: re-runs on shopify:section:load so Theme Editor section
// reload re-binds against the new DOM. Disconnects prior observers +
// removes prior scroll handler on shopify:section:unload to prevent
// observer leaks across editor saves.
(function () {
  var state = null;

  function teardown() {
    if (!state) return;
    if (state.footerIO) state.footerIO.disconnect();
    if (state.ctaIO) state.ctaIO.disconnect();
    if (state.scrollHandler) window.removeEventListener('scroll', state.scrollHandler);
    state = null;
  }

  function init() {
    teardown();

    var bars = document.querySelectorAll(
      '.longeva-service-page__sticky, .longeva-hub__sticky'
    );
    if (!bars.length) return;

    state = {
      bars: bars,
      lastY: window.scrollY,
      ticking: false,
      threshold: 6,
      footerVisible: false,
      ctaVisibleCount: 0,
      footerIO: null,
      ctaIO: null,
      scrollHandler: null,
      scrolledDown: false,
    };

    function applyHide(hide) {
      for (var i = 0; i < state.bars.length; i++) {
        if (hide) state.bars[i].classList.add('is-hidden');
        else state.bars[i].classList.remove('is-hidden');
      }
    }

    function shouldHide() {
      if (state.footerVisible) return true;
      if (state.ctaVisibleCount > 0) return true;
      // After CTA-overlap clears, only show if user is scrolling up.
      return state.scrolledDown;
    }

    function reconcile() {
      applyHide(shouldHide());
    }

    function onScroll() {
      if (state.ticking) return;
      state.ticking = true;
      window.requestAnimationFrame(function () {
        var y = window.scrollY;
        var delta = y - state.lastY;
        if (Math.abs(delta) > state.threshold) {
          state.scrolledDown = delta > 0;
          state.lastY = y;
          reconcile();
        }
        state.ticking = false;
      });
    }

    state.scrollHandler = onScroll;
    window.addEventListener('scroll', onScroll, { passive: true });

    // Footer-overlap guard.
    var footer =
      document.querySelector('.longeva-footer-v2') ||
      document.querySelector('footer.section-footer');
    if (footer && 'IntersectionObserver' in window) {
      state.footerIO = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            state.footerVisible = entry.isIntersecting;
          });
          reconcile();
        },
        { rootMargin: '0px 0px -1px 0px', threshold: 0 }
      );
      state.footerIO.observe(footer);
    }

    // In-page CTA overlap guard. When any in-page Book CTA is on
    // screen the sticky is redundant and competes for attention.
    var ctaTargets = document.querySelectorAll(
      '.longeva-service-page__hero-cta,' +
      '.longeva-service-page__cta-buttons,' +
      '.longeva-hub__primary-cta-wrap,' +
      '.longeva-hub__final-cta'
    );
    if (ctaTargets.length && 'IntersectionObserver' in window) {
      var visibleSet = new Set();
      state.ctaIO = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) visibleSet.add(entry.target);
            else visibleSet.delete(entry.target);
          });
          state.ctaVisibleCount = visibleSet.size;
          reconcile();
        },
        // Threshold 0.4: half-visible counts as 'in view'. Avoids
        // flicker when CTA is partially scrolled into a corner.
        { threshold: 0.4 }
      );
      ctaTargets.forEach(function (t) { state.ctaIO.observe(t); });
    }

    // Initial state: hide until first scroll-up gesture or CTA scroll-out.
    reconcile();
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);

  document.addEventListener('shopify:section:load', init);
  document.addEventListener('shopify:section:unload', teardown);
})();
