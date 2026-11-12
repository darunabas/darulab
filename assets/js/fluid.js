/* Site-wide "dissolve" motion layer for the Daru Lab site. Vanilla JS, no dependencies.
   Loaded on every page from _includes/scripts.html; styles live in assets/css/main.scss.

   - Scroll reveal: elements with [data-reveal], and the children of [data-reveal-children],
     fade in (opacity only) as they enter the viewport. Pages opt in per element, or for the
     whole content area with `reveal: true` in their front matter.
   - Filter bars: [data-filter-bar] with data-filter-key="year" and data-filter-panels=".selector"
     crossfade the old panels out and the new ones in (used by Publications).
   - Tabs: the existing openTab() tabs (Projects, People, Resources, Media) crossfade too.
   - Filter bars and tab rows stay sticky under the fixed masthead.

   Safeguards: entries are only hidden when the early guard in _includes/head/custom.html has
   set html.fluid-motion (JS on, IntersectionObserver available, motion allowed). If this file
   never loads, the guard shows everything again. With reduced motion everything is instant. */
(function () {
  'use strict';

  window.__fluidReady = true;

  var root = document.documentElement;
  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function still() { return !!(reduce && reduce.matches); }
  function $$(sel, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(sel)); }

  var OUT_MS = 200; // must match the .fluid-fade transition in main.scss

  /* ---------- Sticky bars under the fixed masthead ---------- */
  var masthead = document.querySelector('.masthead');
  var stickyTop = 0;
  var bars = $$('[data-filter-bar], .page__content .tab');
  var sentinels = bars.map(function (bar) {
    var s = document.createElement('div');
    s.className = 'fluid-sentinel';
    s.setAttribute('aria-hidden', 'true');
    bar.parentNode.insertBefore(s, bar);
    return s;
  });

  function measure() {
    var mh = 0;
    if (masthead && getComputedStyle(masthead).position === 'fixed') {
      mh = Math.round(masthead.getBoundingClientRect().bottom);
    }
    stickyTop = Math.max(0, mh);
    root.style.setProperty('--fluid-sticky-top', stickyTop + 'px');
    if (bars[0]) root.style.setProperty('--fluid-bar-h', Math.round(bars[0].offsetHeight) + 'px');
  }

  var ticking = false;
  function updateStuck() {
    ticking = false;
    bars.forEach(function (bar, i) {
      bar.classList.toggle('is-stuck', sentinels[i].getBoundingClientRect().top < stickyTop - 1);
    });
  }
  function onScroll() {
    if (!ticking) { ticking = true; window.requestAnimationFrame(updateStuck); }
  }

  // After a filter/tab swap, bring the top of the content back under the bar if we were past it.
  function rewindTo(bar) {
    var i = bars.indexOf(bar);
    if (i < 0) return;
    var top = sentinels[i].getBoundingClientRect().top + window.pageYOffset - stickyTop;
    if (window.pageYOffset > top + 1) window.scrollTo(0, Math.max(0, top));
  }

  // Keep the active button visible when a bar scrolls sideways (phones).
  function centerActive(bar, btn) {
    if (!bar || !btn || bar.scrollWidth <= bar.clientWidth + 1) return;
    var left = btn.offsetLeft - (bar.clientWidth - btn.offsetWidth) / 2; // bar is sticky, so it is the offsetParent
    try { bar.scrollTo({ left: left, behavior: still() ? 'auto' : 'smooth' }); }
    catch (e) { bar.scrollLeft = left; }
  }

  /* ---------- Scroll reveal (pure fade) ---------- */
  function isRevealable(el) {
    if (/^(SCRIPT|STYLE|LINK|META|TEMPLATE)$/.test(el.tagName)) return false;
    if (el.matches('[data-filter-bar], .tab, .fluid-sentinel')) return false;
    return true;
  }
  var targets = $$('[data-reveal], [data-reveal-children] > *').filter(isRevealable);

  function settle(el) {
    el.classList.add('is-in', 'is-settled');
    el.style.transitionDelay = '';
  }

  var io = null;
  if ('IntersectionObserver' in window && root.classList.contains('fluid-motion')) {
    io = new IntersectionObserver(function (records) {
      var batch = records.filter(function (r) { return r.isIntersecting; });
      batch.forEach(function (r, i) {
        var el = r.target;
        io.unobserve(el);
        if (still()) { settle(el); return; }
        var delay = Math.min(i * 70, 350); // soft cascade for items arriving together
        el.style.transitionDelay = delay + 'ms';
        el.classList.add('is-in');
        window.setTimeout(function () { settle(el); }, 700 + delay);
      });
    }, { rootMargin: '0px 0px -5% 0px', threshold: 0.05 });
    targets.forEach(function (el) { io.observe(el); });
  } else {
    targets.forEach(settle);
  }

  /* ---------- Crossfade helper for filters and tabs ---------- */
  function crossfade(state, outgoing, apply, incoming, bar) {
    var my = ++state.token;
    function swap() {
      if (my !== state.token) return;
      outgoing.forEach(function (p) { p.classList.remove('fluid-out'); });
      apply();
      var inc = incoming();
      if (bar) rewindTo(bar);
      if (!still()) {
        inc.forEach(function (p) { p.classList.add('fluid-fade', 'fluid-out'); });
        void document.body.offsetHeight; // commit the transparent state before fading in
        inc.forEach(function (p) { p.classList.remove('fluid-out'); });
      }
      measure();
      onScroll();
    }
    if (still() || !outgoing.length) { swap(); return; }
    outgoing.forEach(function (p) { p.classList.add('fluid-fade', 'fluid-out'); });
    window.setTimeout(swap, OUT_MS);
  }

  function shown(el) { return el.style.display !== 'none' && getComputedStyle(el).display !== 'none'; }

  /* ---------- Filter bars (e.g. Publications years) ---------- */
  $$('[data-filter-bar]').forEach(function (bar) {
    var key = bar.getAttribute('data-filter-key') || 'filter';
    var panels = $$(bar.getAttribute('data-filter-panels') || '[data-' + key + ']:not(button)');
    var btns = $$('button[data-' + key + ']', bar);
    var state = { token: 0 };
    function val(el) { return el.getAttribute('data-' + key); }
    function matches(p, v) { return v === 'all' || val(p) === v; }

    function setActive(v) {
      btns.forEach(function (b) {
        var on = val(b) === v;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (on) centerActive(bar, b);
      });
    }

    function show(v, push, animate) {
      setActive(v);
      if (push) history.replaceState(null, '', v === 'all' ? location.pathname + location.search : '#' + v);
      var apply = function () { panels.forEach(function (p) { p.style.display = matches(p, v) ? '' : 'none'; }); };
      if (!animate) { apply(); measure(); return; }
      crossfade(state, panels.filter(shown), apply,
        function () { return panels.filter(function (p) { return matches(p, v); }); }, bar);
    }

    btns.forEach(function (b) {
      b.setAttribute('aria-pressed', b.classList.contains('active') ? 'true' : 'false');
      b.addEventListener('click', function () {
        if (b.classList.contains('active')) return;
        show(val(b), true, true);
      });
    });

    var h = decodeURIComponent(location.hash.replace('#', ''));
    if (h && h !== 'all' && btns.some(function (b) { return val(b) === h; })) show(h, false, false);
  });

  /* ---------- openTab() tabs: same behavior, with a crossfade ---------- */
  if (typeof window.openTab === 'function' && document.querySelector('.tabcontent')) {
    var tabState = { token: 0 };
    var tabBar = document.querySelector('.page__content .tab');
    window.openTab = function (evt, tabName) {
      var panes = $$('.tabcontent');
      var target = document.getElementById(tabName);
      if (!target) return;
      $$('.tablinks').forEach(function (b) { b.classList.remove('active'); });
      var btn = evt && evt.currentTarget;
      if (btn && btn.classList) { btn.classList.add('active'); centerActive(tabBar, btn); }
      syncTabAria();
      binderSelected();
      var apply = function () {
        panes.forEach(function (p) { p.style.display = 'none'; });
        target.style.display = 'block';
      };
      var current = panes.filter(shown);
      if (current.length === 1 && current[0] === target) { apply(); return; }
      crossfade(tabState, current, apply, function () { return [target]; }, tabBar);
    };
  }

  /* ---------- Binder tabs (shared: People, Projects, Media, Resources) ----------
     Any tab row with class "tab--binder" becomes one row of overlapping divider tabs spanning the card:
     full labels (data-full-name if present, else the button text), the selected tab showing its whole
     label, the others sharing the remaining width evenly (slivers on narrow screens). Tabs to the right
     sit on top, so each tab's leading edge peeks out. ARIA (tablist/tab/tabpanel, aria-selected,
     aria-controls, title/aria-label) is filled in here when the markup doesn't already have it. */
  var binders = $$('.tab--binder');

  binders.forEach(function (bar) {
    if (!bar.hasAttribute('role')) bar.setAttribute('role', 'tablist');
    $$('.tablinks', bar).forEach(function (t, i) {
      var name = t.getAttribute('data-full-name') || t.textContent.trim();
      var m = /openTab\(\s*event\s*,\s*'([^']+)'/.exec(t.getAttribute('onclick') || '');
      var panel = m && document.getElementById(m[1]);
      if (!t.hasAttribute('role')) t.setAttribute('role', 'tab');
      if (!t.title) t.title = name;
      if (!t.hasAttribute('aria-label')) t.setAttribute('aria-label', name);
      if (panel) {
        if (!t.id) t.id = 'tabbtn-' + m[1];
        t.setAttribute('aria-controls', m[1]);
        if (!panel.hasAttribute('role')) panel.setAttribute('role', 'tabpanel');
        if (!panel.hasAttribute('aria-labelledby')) panel.setAttribute('aria-labelledby', t.id);
      }
      t.style.setProperty('--z', String(i + 1));
      var label = document.createElement('span');
      label.className = 'binder-label';
      label.textContent = name;
      t.textContent = '';
      t.appendChild(label);
    });
  });

  function barSpace(bar) {
    var cs = getComputedStyle(bar);
    return {
      avail: bar.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
      tuck: parseFloat(cs.getPropertyValue('--binder-tuck')) || 10
    };
  }

  // Measure each label's natural width, then lay the row out.
  function sizeBinders() {
    binders.forEach(function (bar) {
      bar.classList.add('is-measuring');
      $$('.tablinks', bar).forEach(function (t) {
        t.style.setProperty('--full', (Math.ceil(t.getBoundingClientRect().width) + 1) + 'px');
      });
      bar.classList.remove('is-measuring');
      layoutBinder(bar);
    });
    measure();
  }

  // One row spanning the width: the selected tab is exposed by its whole label (only its slanted
  // trailing edge tucks under the next tab), the last tab is shown whole at the right edge, and every
  // other tab gets an equal share of what is left.
  function layoutBinder(bar) {
    var sp = barSpace(bar), avail = sp.avail, tuck = sp.tuck;
    var tabs = $$('.tablinks', bar);
    var n = tabs.length;
    if (!n) return;
    var full = tabs.map(function (t) { return parseFloat(t.style.getPropertyValue('--full')) || t.offsetWidth; });
    var sel = tabs.findIndex(function (t) { return t.classList.contains('active'); });
    // If the tabs fit at their natural width (each tucking only its slanted edge under the next), keep
    // them that size: the row starts at the left inset and simply stops short of the right edge.
    var natural = full.reduce(function (a, b) { return a + b; }, 0) - (n - 1) * tuck;
    if (natural <= avail) {
      tabs.forEach(function (t, i) {
        var exposed = i === n - 1 ? full[i] : full[i] - tuck;
        t.style.setProperty('--exposed', exposed.toFixed(2) + 'px');
        t.style.setProperty('--w', full[i].toFixed(2) + 'px');
      });
      return;
    }
    // Otherwise spread them evenly across the width with deeper overlap (as on People).
    var selShown = (sel >= 0 && sel < n - 1) ? full[sel] - tuck : 0;
    var others = n - 1 - (selShown ? 1 : 0);
    var step = others ? Math.max(12, (avail - full[n - 1] - selShown) / others) : 0;
    tabs.forEach(function (t, i) {
      var last = i === n - 1;
      var exposed = last ? Math.max(full[i], avail - selShown - others * step) : (i === sel ? selShown : step);
      // short labels still get a body that reaches under the next tab, so there is never a gap
      var w = last ? exposed : Math.max(full[i], exposed + tuck);
      t.style.setProperty('--exposed', exposed.toFixed(2) + 'px');
      t.style.setProperty('--w', w.toFixed(2) + 'px');
    });
  }

  function binderSelected() { binders.forEach(layoutBinder); }

  /* ---------- Tab roles: aria-selected, roving tabindex, arrow keys ---------- */
  function syncTabAria() {
    $$('[role="tablist"]').forEach(function (list) {
      $$('[role="tab"]', list).forEach(function (t) {
        var on = t.classList.contains('active');
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });
    });
  }
  $$('[role="tablist"]').forEach(function (list) {
    list.addEventListener('keydown', function (e) {
      var tabs = $$('[role="tab"]', list);
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      var next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      var t = tabs[(next + tabs.length) % tabs.length];
      t.focus();
      t.click(); // automatic activation, through the page's own openTab()
    });
  });
  syncTabAria();


  sizeBinders();
  if (binders.length && document.fonts && document.fonts.ready) document.fonts.ready.then(sizeBinders);

  /* ---------- Init ---------- */
  measure();
  updateStuck();
  window.addEventListener('scroll', onScroll, { passive: true });
  var rz;
  window.addEventListener('resize', function () {
    window.clearTimeout(rz);
    rz = window.setTimeout(function () { sizeBinders(); measure(); updateStuck(); }, 100);
  });
  window.addEventListener('load', function () { measure(); updateStuck(); });
  if (reduce && reduce.addEventListener) {
    reduce.addEventListener('change', function () { if (still()) targets.forEach(settle); });
  }
})();
