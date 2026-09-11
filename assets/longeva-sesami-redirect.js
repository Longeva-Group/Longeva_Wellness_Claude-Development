// Sesami booking flow: auto-redirect to /cart after a successful
// /cart/add.js POST.
//
// Sesami's web component does not redirect anywhere by default when
// `skip-cart` is unset. We want patients to land on /cart immediately
// after they confirm a slot so they can verify date / time before
// checkout. Setting skip-cart=true would jump straight to /checkout
// and bypass the verification step we explicitly want them to see.
//
// Implementation: scope the script to pages that contain a Sesami
// cart form (data-sesami-cart-form). Monkey-patch window.fetch so
// that when sesami-main.js POSTs to /cart/add(.js), we redirect to
// /cart on success. The intercept is keyed on URL + method so unrelated
// fetches (Sesami availability polling, Shopify analytics) pass through
// untouched. The 200ms defer lets Sesami's own .then() handler resolve
// first (close the modal, fire its success event) before navigation.
(function () {
  if (!document.querySelector('[data-sesami-cart-form]')) return;

  var origFetch = window.fetch;
  if (!origFetch || origFetch.__longevaSesamiPatched) return;

  function patched(input, init) {
    var url = '';
    if (typeof input === 'string') {
      url = input;
    } else if (input && typeof input.url === 'string') {
      url = input.url;
    }
    var method = '';
    if (init && typeof init.method === 'string') {
      method = init.method;
    } else if (input && typeof input.method === 'string') {
      method = input.method;
    }
    var promise = origFetch.apply(this, arguments);
    var isCartAdd = /\/cart\/add(\.js)?(?:\?|$)/i.test(url);
    var isPost = /post/i.test(method);
    if (isCartAdd && isPost) {
      promise
        .then(function (r) {
          if (r && r.ok) {
            setTimeout(function () {
              window.location.assign('/cart');
            }, 200);
          }
        })
        .catch(function () {});
    }
    return promise;
  }
  patched.__longevaSesamiPatched = true;
  window.fetch = patched;
})();
