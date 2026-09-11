// Variant picker.
//
// Routes the patient's variant choice to every Sesami cart-add form on
// the page and updates the displayed price in hero and sticky bar.
//
// Critical detail: setting <input>.value = X is INVISIBLE to listeners
// (Sesami caches the form id via DOM read on its own mount). We must
// dispatch a real `change` event after the write, otherwise Sesami
// books the variant the page first rendered with, ignoring the swap.
// Verified live 2026-05-12.
//
// Section-load handling: the inner `bind()` runs every time the
// Theme Editor re-renders the section. The IIFE itself never re-runs
// (Shopify loads the asset once per page), so we do NOT manage a
// global init flag. AbortController keys the listeners so a re-bind
// cleanly drops the previous handlers.

(function () {
  var controller = null;

  function dispatchChange(input) {
    var evt;
    try {
      evt = new Event('change', { bubbles: true });
    } catch (e) {
      evt = document.createEvent('Event');
      evt.initEvent('change', true, true);
    }
    input.dispatchEvent(evt);
  }

  function updateForms(variantId) {
    var forms = document.querySelectorAll('[data-sesami-cart-form]');
    for (var i = 0; i < forms.length; i++) {
      var input = forms[i].querySelector('input[type="hidden"][name="id"]');
      if (!input) continue;
      if (input.value === variantId) continue;
      input.value = variantId;
      dispatchChange(input);
    }
  }

  function updatePriceDisplay(priceMoney) {
    var heroPrice = document.querySelector('.longeva-service-page__meta-price');
    if (heroPrice) heroPrice.textContent = priceMoney;
    var stickyPrice = document.querySelector('.longeva-service-page__sticky-meta-price');
    if (stickyPrice) stickyPrice.textContent = 'From ' + priceMoney;
  }

  function updateAnnounce(title, priceMoney) {
    var region = document.getElementById('longeva-variant-picker-announce');
    if (region) region.textContent = 'Selected: ' + title + ', ' + priceMoney;
  }

  function onChange(e) {
    var radio = e.target;
    if (!radio || radio.name !== 'longeva-variant') return;
    if (!radio.closest || !radio.closest('.longeva-variant-picker')) return;
    var label = radio.closest('.longeva-variant-picker__card');
    if (!label) return;
    var variantId = label.getAttribute('data-variant-id');
    var priceMoney = label.getAttribute('data-variant-price-money');
    var title = label.getAttribute('data-variant-title');
    if (!variantId) return;
    updateForms(variantId);
    if (priceMoney) updatePriceDisplay(priceMoney);
    if (title && priceMoney) updateAnnounce(title, priceMoney);
  }

  function bind() {
    if (controller) controller.abort();
    var picker = document.querySelector('.longeva-variant-picker');
    if (!picker) {
      controller = null;
      return;
    }
    controller = new AbortController();
    picker.addEventListener('change', onChange, { signal: controller.signal });
  }

  if (document.readyState !== 'loading') {
    bind();
  } else {
    document.addEventListener('DOMContentLoaded', bind);
  }
  document.addEventListener('shopify:section:load', bind);
  document.addEventListener('shopify:section:unload', function () {
    if (controller) controller.abort();
    controller = null;
  });
})();
