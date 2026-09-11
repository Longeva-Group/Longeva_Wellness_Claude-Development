// Services directory page interactions: client-side filter on the
// service catalogue + hide-on-scroll-down for the sticky controls bar.
//
// Init pattern (PR #196): re-runs on shopify:section:load so Theme
// Editor reloads re-bind against the new DOM. Removes prior scroll +
// hashchange handlers on shopify:section:unload so observers do not
// stack across editor saves.
(() => {
  let state = null; // { input, controls, scrollHandler, hashHandler, focusHandler, inputHandler }

  const teardown = () => {
    if (!state) return;
    if (state.scrollHandler) window.removeEventListener('scroll', state.scrollHandler);
    if (state.hashHandler) window.removeEventListener('hashchange', state.hashHandler);
    if (state.input && state.focusHandler) state.input.removeEventListener('focus', state.focusHandler);
    if (state.input && state.inputHandler) state.input.removeEventListener('input', state.inputHandler);
    state = null;
  };

  const init = () => {
    teardown();

    const input = document.querySelector('[data-longeva-directory-search]');
    if (!input) return;

    const empty = document.querySelector('[data-longeva-directory-empty]');
    const items = Array.from(document.querySelectorAll('[data-longeva-directory-item]'));
    const groups = Array.from(document.querySelectorAll('[data-longeva-directory-group]'));
    const controls = document.querySelector('[data-longeva-directory-controls]');

    state = { input, controls, scrollHandler: null, hashHandler: null, focusHandler: null, inputHandler: null };

    const debounce = (fn, ms = 80) => {
      let t;
      return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
      };
    };

    const filter = () => {
      const q = input.value.trim().toLowerCase();
      let anyVisible = false;

      items.forEach((it) => {
        const name = it.dataset.name || '';
        const match = !q || name.includes(q);
        it.hidden = !match;
        if (match) anyVisible = true;
      });

      groups.forEach((g) => {
        const visibleCount = g.querySelectorAll(
          '[data-longeva-directory-item]:not([hidden])'
        ).length;
        g.hidden = visibleCount === 0;
      });

      if (empty) empty.hidden = anyVisible;
    };

    state.inputHandler = debounce(filter);
    input.addEventListener('input', state.inputHandler);

    const params = new URLSearchParams(location.search);
    const initial = params.get('q');
    if (initial) {
      input.value = initial;
      filter();
    }

    // Hide-on-scroll-down / show-on-scroll-up for the sticky controls.
    // Reopened 2026-05-07: bar was always visible and read cluttered while
    // reading content. Convention: bar hides as user scrolls down to read,
    // returns when they scroll up to navigate. Always visible above the
    // 200px fold so first-time users orient. Anchor-link clicks
    // (#aesthetics, #skin-health, etc.) force-show via hashchange.
    if (controls) {
      let lastY = window.scrollY;
      let ticking = false;
      const FOLD = 200;
      const THRESH = 6;
      const onScroll = () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(() => {
          const y = window.scrollY;
          // If the user is typing in the search input, never hide the bar
          // even on scroll. Update lastY so the next gesture computes
          // delta from where we actually are, not where we left off.
          if (document.activeElement === input) {
            controls.classList.remove('is-hidden');
            lastY = y;
            ticking = false;
            return;
          }
          const delta = y - lastY;
          if (y < FOLD) {
            controls.classList.remove('is-hidden');
          } else if (Math.abs(delta) > THRESH) {
            if (delta > 0) controls.classList.add('is-hidden');
            else controls.classList.remove('is-hidden');
          }
          // lastY MUST update on every rAF tick, not only inside the
          // delta branch above. Otherwise lastY stays stale through the
          // pre-fold window, and the first frame past 200px computes a
          // huge positive delta that slams the bar shut on a slow scroll.
          lastY = y;
          ticking = false;
        });
      };
      state.scrollHandler = onScroll;
      window.addEventListener('scroll', onScroll, { passive: true });

      state.hashHandler = () => {
        controls.classList.remove('is-hidden');
        // Anchor jumps move scrollY by hundreds of pixels in one frame.
        // Reset lastY to the post-jump position so the next real scroll
        // is measured from there, not from the pre-jump baseline.
        lastY = window.scrollY;
      };
      window.addEventListener('hashchange', state.hashHandler);

      // When the search input gets focus, force show so the user can
      // see the bar they are typing into.
      state.focusHandler = () => controls.classList.remove('is-hidden');
      input.addEventListener('focus', state.focusHandler);
    }
  };

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);

  document.addEventListener('shopify:section:load', init);
  document.addEventListener('shopify:section:unload', teardown);
})();
