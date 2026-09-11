// Longeva cart page interactions.
//
// Layered on top of the Liquid form-post fallback (see
// sections/longeva-cart-page.liquid). When JS is available:
//   - +/- buttons update line quantity via /cart/change.js
//   - Direct qty input edits update on debounce
//   - Remove link removes the line without a full form post
// All updates trigger a soft re-render by reloading the section,
// which is simpler and more reliable than client-side total math
// for v1. Cart is rarely visited, so the reload tax is negligible.
//
// Init pattern: re-runs on shopify:section:load so the Theme Editor
// section reload re-binds against the new DOM. Idempotency guard via
// data-longeva-init prevents double-binding on initial paint.

(function () {
  var rootURL = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  var changeURL = rootURL.replace(/\/$/, '') + '/cart/change.js';

  function initCart() {
    var form = document.querySelector('[data-longeva-cart-form]');
    if (!form) return;
    if (form.getAttribute('data-longeva-init') === '1') return;
    form.setAttribute('data-longeva-init', '1');

    function setItemBusy(item, busy) {
      if (!item) return;
      item.classList.toggle('is-busy', !!busy);
    }

    function setFormBusy(busy) {
      if (busy) form.setAttribute('data-busy', '1');
      else form.removeAttribute('data-busy');
    }

    function isFormBusy() {
      return form.getAttribute('data-busy') === '1';
    }

    function reloadCart() {
      // Flag persists across reload so the next paint can announce
      // the change to assistive tech via the live region in the
      // section markup.
      try { sessionStorage.setItem('longeva_cart_updated', '1'); } catch (_) {}
      window.location.reload();
    }

    function changeLine(item, qty) {
      if (!item) return;
      // Form-level lock: rapid multi-item +/- clicks otherwise fire
      // overlapping fetches, the first reload kills the second update.
      if (isFormBusy()) return;
      var key = item.getAttribute('data-line-key');
      if (!key) return;
      setFormBusy(true);
      setItemBusy(item, true);
      fetch(changeURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ id: key, quantity: qty })
      })
        .then(function (r) {
          if (!r.ok) {
            setFormBusy(false);
            setItemBusy(item, false);
            return;
          }
          // Clear busy state before reload so a cancelled navigation
          // (extension, beforeunload dialog) does not leave the row
          // permanently locked.
          setFormBusy(false);
          setItemBusy(item, false);
          reloadCart();
        })
        .catch(function () {
          setFormBusy(false);
          setItemBusy(item, false);
        });
    }

    // Qty +/- buttons
    form.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-longeva-qty-decrease], [data-longeva-qty-increase]');
      if (!btn) return;
      e.preventDefault();
      var item = btn.closest('[data-longeva-cart-item]');
      if (!item) return;
      var input = item.querySelector('[data-longeva-qty-input]');
      if (!input) return;
      var v = parseInt(input.value, 10);
      if (isNaN(v)) v = 0;
      if (btn.hasAttribute('data-longeva-qty-decrease')) v = Math.max(0, v - 1);
      else v = v + 1;
      input.value = v;
      changeLine(item, v);
    });

    // Remove link
    form.addEventListener('click', function (e) {
      var link = e.target.closest('[data-longeva-cart-remove]');
      if (!link) return;
      e.preventDefault();
      var item = link.closest('[data-longeva-cart-item]');
      if (!item) return;
      changeLine(item, 0);
    });

    // Direct qty edit, debounced
    var debounceTimer;
    form.addEventListener('input', function (e) {
      var input = e.target.closest('[data-longeva-qty-input]');
      if (!input) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        var v = parseInt(input.value, 10);
        if (isNaN(v) || v < 0) v = 0;
        var item = input.closest('[data-longeva-cart-item]');
        changeLine(item, v);
      }, 600);
    });
  }

  // Announce cart updates to assistive tech on the post-reload paint.
  // Reload destroys focus context, so we rely on a polite live region
  // injected with text content after the new DOM lands.
  function announceUpdate() {
    var live;
    try {
      if (sessionStorage.getItem('longeva_cart_updated') !== '1') return;
      sessionStorage.removeItem('longeva_cart_updated');
    } catch (_) { return; }
    live = document.querySelector('[data-longeva-cart-live]');
    if (!live) return;
    // Defer so the polite region is empty at paint, then receives
    // text. Some screen readers ignore content already present at
    // first announce.
    setTimeout(function () { live.textContent = 'Cart updated'; }, 50);
  }

  function boot() {
    initCart();
    announceUpdate();
  }

  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);

  // Theme Editor: re-init after section reload so the new DOM has
  // listeners. The data-longeva-init guard inside initCart prevents
  // double-binding on the same form node.
  document.addEventListener('shopify:section:load', initCart);
})();
