// Sesami calendar: inject month + year jump dropdowns into the
// calendar header.
//
// Sesami's storefront calendar offers Today / Previous / Next arrows
// only. There is no native month/year picker (verified via Sesami
// app Settings 2026-05-09 on the Pro plan). For patients booking
// further than two months out, arrow-by-arrow navigation is friction.
//
// Why custom dropdowns and not native <select>:
// Sesami renders the calendar inside a deeply nested shadow DOM with
// a focus-trapping modal wrapper. Native <select> opens its picker
// as an OS-level popup, and inside that focus trap the picker fails
// to surface (the click is received but no UI appears). Verified
// 2026-05-09 via Chrome DevTools: mousedown propagates with
// defaultPrevented=false but the OS picker never paints. Custom
// button + listbox lives entirely in the shadow tree, so no native
// popup is involved.

(function () {
  if (window.__longevaSesamiCalendarEnhanced) return;
  window.__longevaSesamiCalendarEnhanced = true;

  var MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  function deepFind(root, selector) {
    if (!root) return null;
    var found = null;
    try { found = root.querySelector(selector); } catch (e) {}
    if (found) return found;
    var hosts = [];
    try { hosts = root.querySelectorAll('*'); } catch (e) {}
    for (var i = 0; i < hosts.length; i++) {
      if (hosts[i].shadowRoot) {
        var f = deepFind(hosts[i].shadowRoot, selector);
        if (f) return f;
      }
    }
    return null;
  }

  function deepFindAll(root, selector) {
    var out = [];
    if (!root) return out;
    try { out = Array.prototype.slice.call(root.querySelectorAll(selector)); } catch (e) {}
    var hosts = [];
    try { hosts = root.querySelectorAll('*'); } catch (e) {}
    for (var i = 0; i < hosts.length; i++) {
      if (hosts[i].shadowRoot) {
        out = out.concat(deepFindAll(hosts[i].shadowRoot, selector));
      }
    }
    return out;
  }

  function getCurrent(win) {
    if (!win || !win.shadowRoot) return null;
    var yearEl = deepFind(win.shadowRoot, '.secondaryTitle');
    var monthEl = deepFind(win.shadowRoot, '.primaryTitle');
    if (!yearEl || !monthEl) return null;
    var year = parseInt((yearEl.textContent || '').trim(), 10);
    var month = (monthEl.textContent || '').trim();
    if (!year || MONTHS.indexOf(month) < 0) return null;
    return { year: year, month: month };
  }

  function clickActionButton(btn) {
    if (!btn) return;
    var inner = btn.shadowRoot ? btn.shadowRoot.querySelector('button') : null;
    var target = inner || btn;
    ['pointerdown', 'pointerup', 'click'].forEach(function (type) {
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, composed: true }));
    });
  }

  function navigateBy(win, delta) {
    return new Promise(function (resolve) {
      if (!delta) return resolve();
      var title = delta > 0 ? 'Next' : 'Previous';
      var btn = deepFindAll(win.shadowRoot, 'sesami-action-button[title="' + title + '"]')[0];
      if (!btn) return resolve();
      var remaining = Math.abs(delta);
      function step() {
        if (remaining <= 0) return resolve();
        clickActionButton(btn);
        remaining--;
        setTimeout(step, 230);
      }
      step();
    });
  }

  // Custom dropdown: a trigger <button> + an absolutely positioned
  // <div> with one <button> per option. Both live in the calendar's
  // shadow tree, no native popup.
  function makeDropdown(opts) {
    // opts: { ariaLabel, items: [{value, text}], value, onChange }
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;display:inline-block;';

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.setAttribute('aria-label', opts.ariaLabel);
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.style.cssText =
      'font:13px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;' +
      'padding:6px 26px 6px 12px;border:1px solid rgba(185,145,87,0.55);' +
      'border-radius:999px;background:#FFFFFF;color:#2D190E;cursor:pointer;' +
      'min-height:30px;display:inline-flex;align-items:center;gap:6px;' +
      'background-image:url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\' viewBox=\'0 0 10 6\'><path d=\'M1 1l4 4 4-4\' stroke=\'%23B99157\' stroke-width=\'1.5\' fill=\'none\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/></svg>");' +
      'background-repeat:no-repeat;background-position:right 10px center;';

    var menu = document.createElement('div');
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', opts.ariaLabel);
    menu.style.cssText =
      'position:absolute;top:calc(100% + 4px);left:0;z-index:50;' +
      'min-width:100%;max-height:240px;overflow-y:auto;' +
      'background:#FFFFFF;border:1px solid rgba(185,145,87,0.4);' +
      'border-radius:10px;box-shadow:0 8px 24px rgba(45,25,14,0.12);' +
      'padding:4px;display:none;';

    var optionButtons = [];
    function setValue(v, fire) {
      wrap._value = v;
      var match = opts.items.filter(function (it) { return String(it.value) === String(v); })[0];
      trigger.firstChild ? (trigger.firstChild.nodeValue = match ? match.text : '') : trigger.appendChild(document.createTextNode(match ? match.text : ''));
      optionButtons.forEach(function (b) {
        var on = String(b.dataset.value) === String(v);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        b.style.background = on ? 'rgba(185,145,87,0.12)' : 'transparent';
        b.style.color = '#2D190E';
      });
      if (fire && opts.onChange) opts.onChange(v);
    }

    function open() {
      menu.style.display = 'block';
      trigger.setAttribute('aria-expanded', 'true');
      // Outside-click close: bind a single capture listener
      setTimeout(function () {
        document.addEventListener('pointerdown', outside, true);
      }, 0);
    }
    function close() {
      menu.style.display = 'none';
      trigger.setAttribute('aria-expanded', 'false');
      document.removeEventListener('pointerdown', outside, true);
    }
    function toggle() {
      if (menu.style.display === 'block') close(); else open();
    }
    function outside(e) {
      // Use composedPath so we correctly detect clicks inside our
      // own shadow-rendered popup.
      var path = e.composedPath ? e.composedPath() : [];
      if (path.indexOf(wrap) >= 0) return;
      close();
    }

    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });

    opts.items.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'option');
      b.dataset.value = String(it.value);
      b.textContent = it.text;
      b.style.cssText =
        'display:block;width:100%;text-align:left;padding:6px 10px;' +
        'border:0;background:transparent;color:#2D190E;cursor:pointer;' +
        'font:13px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;' +
        'border-radius:6px;';
      b.addEventListener('mouseenter', function () {
        if (b.getAttribute('aria-selected') === 'true') return;
        b.style.background = 'rgba(185,145,87,0.06)';
      });
      b.addEventListener('mouseleave', function () {
        if (b.getAttribute('aria-selected') === 'true') return;
        b.style.background = 'transparent';
      });
      b.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        setValue(it.value, true);
        close();
      });
      optionButtons.push(b);
      menu.appendChild(b);
    });

    wrap.appendChild(trigger);
    wrap.appendChild(menu);

    wrap.setValueSilent = function (v) { setValue(v, false); };
    wrap.getValue = function () { return wrap._value; };
    wrap.addItem = function (it) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'option');
      b.dataset.value = String(it.value);
      b.textContent = it.text;
      b.style.cssText =
        'display:block;width:100%;text-align:left;padding:6px 10px;' +
        'border:0;background:transparent;color:#2D190E;cursor:pointer;' +
        'font:13px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;' +
        'border-radius:6px;';
      b.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        setValue(it.value, true);
        close();
      });
      optionButtons.push(b);
      menu.appendChild(b);
    };
    wrap.hasItem = function (v) {
      return optionButtons.some(function (b) { return String(b.dataset.value) === String(v); });
    };

    setValue(opts.value, false);
    return wrap;
  }

  function syncDropdowns(state, monthDD, yearDD) {
    if (!state) return;
    var idx = MONTHS.indexOf(state.month);
    if (idx >= 0 && String(monthDD.getValue()) !== String(idx)) {
      monthDD.setValueSilent(idx);
    }
    if (String(yearDD.getValue()) !== String(state.year)) {
      if (!yearDD.hasItem(state.year)) {
        yearDD.addItem({ value: state.year, text: state.year });
      }
      yearDD.setValueSilent(state.year);
    }
  }

  function inject(win) {
    if (!win || !win.shadowRoot) return false;
    var titleWrapper = deepFind(win.shadowRoot, '.titleWrapper');
    if (!titleWrapper) return false;
    if (titleWrapper.getAttribute('data-longeva-injected') === '1') return true;

    var current = getCurrent(win);
    if (!current) return false;

    var row = document.createElement('div');
    row.className = 'longeva-jump-row';
    row.style.cssText =
      'display:flex;gap:8px;margin-top:10px;align-items:center;justify-content:flex-start;flex-wrap:wrap;';

    var jumpLabel = document.createElement('span');
    jumpLabel.textContent = 'Jump to';
    jumpLabel.style.cssText =
      'font:11px/1 system-ui,-apple-system,"Segoe UI",sans-serif;' +
      'letter-spacing:0.04em;text-transform:uppercase;color:rgba(45,25,14,0.55);';

    var busy = false;
    var monthDD, yearDD;

    function jump() {
      if (busy) return;
      var cur = getCurrent(win);
      if (!cur) return;
      var targetMonth = parseInt(monthDD.getValue(), 10);
      var targetYear = parseInt(yearDD.getValue(), 10);
      var curIdx = MONTHS.indexOf(cur.month);
      var delta = (targetYear - cur.year) * 12 + (targetMonth - curIdx);
      if (!delta) return;
      busy = true;
      navigateBy(win, delta).then(function () {
        busy = false;
        syncDropdowns(getCurrent(win), monthDD, yearDD);
      });
    }

    monthDD = makeDropdown({
      ariaLabel: 'Jump to month',
      items: MONTHS.map(function (m, i) { return { value: i, text: m }; }),
      value: MONTHS.indexOf(current.month),
      onChange: jump,
    });

    var years = [];
    for (var y = current.year - 1; y <= current.year + 2; y++) {
      years.push({ value: y, text: y });
    }
    yearDD = makeDropdown({
      ariaLabel: 'Jump to year',
      items: years,
      value: current.year,
      onChange: jump,
    });

    row.appendChild(jumpLabel);
    row.appendChild(monthDD);
    row.appendChild(yearDD);
    titleWrapper.appendChild(row);
    titleWrapper.setAttribute('data-longeva-injected', '1');

    var headerObserver = new MutationObserver(function () {
      if (busy) return;
      syncDropdowns(getCurrent(win), monthDD, yearDD);
    });
    headerObserver.observe(titleWrapper, { childList: true, subtree: true, characterData: true });

    return true;
  }

  function tryInject() {
    var win = document.querySelector('sesami-window');
    if (!win) return false;
    return inject(win);
  }

  var docObserver = new MutationObserver(function () {
    setTimeout(tryInject, 300);
  });
  docObserver.observe(document.body, { childList: true, subtree: true });

  setTimeout(tryInject, 500);
  setTimeout(tryInject, 1500);
})();
