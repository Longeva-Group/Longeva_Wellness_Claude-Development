/*
 * Longeva premium animations. Vanilla, lightweight, accessibility-first.
 *
 * Contract:
 * - Content renders in final state via CSS. This script only adds the
 *   entrance transform. If JS is blocked, everything is visible.
 * - Honours `prefers-reduced-motion: reduce` by no-op on all motion.
 * - One shared IntersectionObserver for reveal, unobserved after firing.
 * - Only transform + opacity properties animate (GPU-composited).
 * - No layout thrashing: classes toggle once on the way in, then
 *   will-change is cleared on transitionend.
 */

(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  var reduced = false;
  try {
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { /* older browser */ }

  // When the user prefers reduced motion, force everything to final state
  // and exit. We also mark the root so CSS can skip transitions.
  if (reduced) {
    document.documentElement.classList.add('longeva-motion-off');
    // Flip all reveals to visible immediately.
    document.querySelectorAll('[data-longeva-reveal]').forEach(function (el) {
      el.classList.add('is-in');
    });
    return;
  }

  document.documentElement.classList.add('longeva-motion-on');

  // --- Reveal on scroll --------------------------------------------------
  var revealQueue = [];
  function collectReveals() {
    return Array.prototype.slice.call(document.querySelectorAll('[data-longeva-reveal]:not(.is-in)'));
  }

  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var delay = parseInt(el.getAttribute('data-longeva-delay') || '0', 10);
        if (delay > 0) {
          setTimeout(function () { el.classList.add('is-in'); }, delay);
        } else {
          el.classList.add('is-in');
        }
        revealObserver.unobserve(el);
        // Clear will-change after the transition completes.
        el.addEventListener('transitionend', function clear() {
          el.style.willChange = '';
          el.removeEventListener('transitionend', clear);
        });
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

    revealQueue = collectReveals();
    revealQueue.forEach(function (el) {
      el.style.willChange = 'opacity, transform';
      revealObserver.observe(el);
    });
  } else {
    // No IntersectionObserver? Show everything.
    collectReveals().forEach(function (el) { el.classList.add('is-in'); });
  }

  // --- Stagger groups ----------------------------------------------------
  // Any container with [data-longeva-stagger] auto-delays its direct
  // [data-longeva-reveal] children so the page doesn't need per-element
  // delays in HTML.
  document.querySelectorAll('[data-longeva-stagger]').forEach(function (group) {
    var base = parseInt(group.getAttribute('data-longeva-stagger') || '60', 10);
    var children = Array.prototype.slice.call(group.children);
    children.forEach(function (child, i) {
      var target = child.hasAttribute('data-longeva-reveal') ? child : child.querySelector('[data-longeva-reveal]');
      if (!target) return;
      if (!target.hasAttribute('data-longeva-delay')) {
        target.setAttribute('data-longeva-delay', String(i * base));
      }
    });
  });

  // Hero cursor tilt intentionally removed 2026-04-21. The 3D rotate
  // flourish fought the "professional, not premium" brand direction
  // and contributed to a 246ms INP reading. The hero reads cleaner
  // static; the monogram is strong enough to carry the panel alone.

  // --- Count-up ----------------------------------------------------------
  // Number elements with [data-longeva-count] animate from 0 to the
  // element's original text content, preserving prefixes/suffixes like £.
  var countEls = Array.prototype.slice.call(document.querySelectorAll('[data-longeva-count]:not(.is-counted)'));
  function animateCount(el) {
    var raw = (el.textContent || '').trim();
    var match = raw.match(/^(\D*)([\d,]+(?:\.\d+)?)(\D*)$/);
    if (!match) return;
    var prefix = match[1];
    var target = parseFloat(match[2].replace(/,/g, ''));
    var suffix = match[3];
    if (!isFinite(target)) return;
    var decimals = (match[2].split('.')[1] || '').length;
    var duration = parseInt(el.getAttribute('data-longeva-count-duration') || '1000', 10);
    var start = performance.now();
    el.classList.add('is-counted');
    function frame(now) {
      var t = Math.min(1, (now - start) / duration);
      var eased = 1 - Math.pow(1 - t, 3);
      var current = target * eased;
      el.textContent = prefix + current.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + suffix;
      if (t < 1) requestAnimationFrame(frame);
      else el.textContent = raw;
    }
    requestAnimationFrame(frame);
  }

  if (countEls.length && 'IntersectionObserver' in window) {
    var countObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          animateCount(e.target);
          countObs.unobserve(e.target);
        }
      });
    }, { threshold: 0.5 });
    countEls.forEach(function (el) { countObs.observe(el); });
  }

  // --- Late-arriving nodes (Shopify section re-renders) ------------------
  // Re-scan on Shopify section load so theme editor updates still animate.
  document.addEventListener('shopify:section:load', function () {
    if (!('IntersectionObserver' in window)) return;
    var fresh = collectReveals();
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        obs.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    fresh.forEach(function (el) { obs.observe(el); });
  });
})();
