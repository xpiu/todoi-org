/* todoi.org — client-side behaviour layer.
 * Progressive enhancement only: every record is already in the HTML; this file
 * filters, sorts, expands and announces. Any element named in the DOM contract
 * that is absent simply disables its own feature — nothing throws.
 * No dependencies, no globals, no innerHTML written from data. */
(function () {
  'use strict';

  /* --- utils --- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function closest(node, sel) { return node && node.closest ? node.closest(sel) : null; }

  // localStorage can throw in sandboxed iframes and embedded webviews.
  function storeSet(key, value) {
    try { window.localStorage.setItem(key, value); }
    catch (e) { /* quota, disabled storage, sandbox */ }
  }
  function num(el, key) {
    var v = parseFloat(el.getAttribute('data-' + key));
    return isNaN(v) ? -Infinity : v; // unreadable/missing sorts last in desc
  }
  function str(el, key) { return (el.getAttribute('data-' + key) || '').toLowerCase(); }
  function mediaQuery(query) {
    try { return window.matchMedia(query); }
    catch (e) { return null; }
  }

  // Rows live in a <table>, where a stylesheet rule such as `tr{display:table-row}`
  // can out-specify the UA's [hidden] rule. Set both: attribute for semantics,
  // inline display for a guaranteed visual effect.
  function setShown(el, show) {
    if (!el) return;
    el.hidden = !show;
    el.style.display = show ? '' : 'none';
  }

  // A page may carry its own copy and keys (the commercial directory does):
  // <script type="application/json" id="directory-config">. Anything it leaves
  // out falls back to the open-source directory's defaults below.
  var CFG = (function () {
    var el = document.getElementById('directory-config');
    if (!el) return {};
    try { return JSON.parse(el.textContent) || {}; } catch (e) { return {}; }
  }());
  function merge(base, extra) {
    if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) base[k] = extra[k];
    return base;
  }

  var reduceMotion = mediaQuery('(prefers-reduced-motion: reduce)') || { matches: false };

  /* --- theme --- */
  // NOTE: app.js is deferred, so first paint happens before this runs. index.html
  // must carry a tiny inline, blocking <head> script that reads the saved choice
  // or resolves the system preference (falling back to light), then stamps
  // <html data-theme> before paint. This block owns persistence, live system
  // preference changes, ARIA state and the keyboard.
  (function theme() {
    var root = document.documentElement;
    var group = $('#theme-switch');
    if (!group) return;
    var opts = $$('.theme-switch-opt[data-theme-value]', group);
    if (!opts.length) return;
    var KEY = 'todoi-theme';

    function modeOf(el) { return el.getAttribute('data-theme-value'); }

    function apply(mode) {
      mode = mode === 'dark' ? 'dark' : 'light';
      root.setAttribute('data-theme', mode);
      // Roving tabindex: the occupied seat is the group's single tab stop, so
      // Tab passes the switch in one press and the arrows work it.
      opts.forEach(function (el) {
        var on = modeOf(el) === mode;
        el.setAttribute('aria-checked', String(on));
        el.tabIndex = on ? 0 : -1;
      });
    }

    function choose(mode) {
      root.removeAttribute('data-theme-source');
      storeSet(KEY, mode);
      apply(mode);
    }

    apply(root.getAttribute('data-theme'));

    // With no saved choice, stay in sync with the operating-system preference.
    // Browsers without matchMedia simply keep the light fallback from <head>.
    if (root.getAttribute('data-theme-source') === 'system') {
      var systemScheme = mediaQuery('(prefers-color-scheme: dark)');
      function followSystem(e) {
        if (root.getAttribute('data-theme-source') === 'system') {
          apply(e.matches ? 'dark' : 'light');
        }
      }
      if (systemScheme) {
        if (systemScheme.addEventListener) systemScheme.addEventListener('change', followSystem);
        else if (systemScheme.addListener) systemScheme.addListener(followSystem);
      }
    }

    group.addEventListener('click', function (e) {
      var opt = closest(e.target, '.theme-switch-opt');
      if (opt) choose(modeOf(opt));
    });

    // Radio-group keys: arrows move the selection with wraparound, Home and End
    // jump to the ends. Selection follows focus, as it does in a radio group.
    var STEP = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };
    group.addEventListener('keydown', function (e) {
      var i = opts.indexOf(document.activeElement);
      var next = null;
      if (STEP[e.key] && i > -1) next = opts[(i + STEP[e.key] + opts.length) % opts.length];
      else if (e.key === 'Home') next = opts[0];
      else if (e.key === 'End') next = opts[opts.length - 1];
      if (!next) return;
      e.preventDefault();
      choose(modeOf(next));
      next.focus();
    });
  })();

  /* --- directory board --- */
  var rows = $$('tr.matrix-row');
  var cards = $$('article.card');
  var hasBoard = rows.length > 0 || cards.length > 0;

  /* --- one copy of each record's detail ---
   * Every record's detail ships once, inside its matrix row; the card's panel
   * arrives empty, because carrying both copies nearly doubled the page. The
   * details live in whichever list is on screen: the cards below 900px (the
   * breakpoint in style.css), the matrix above it, and the matrix in print,
   * which always prints the table. */
  var cardsQuery = window.matchMedia ? window.matchMedia('screen and (max-width: 899.98px)') : null;
  function placeDetails(intoCards) {
    cards.forEach(function (card) {
      var slug = card.getAttribute('data-slug');
      var panel = $('.card-detail', card);
      var row = null;
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].getAttribute('data-slug') === slug) { row = rows[i]; break; }
      }
      var detailRow = row && row.nextElementSibling;
      var cell = detailRow && detailRow.classList.contains('detail-row') ? detailRow.firstElementChild : null;
      if (!panel || !cell) return;
      var from = intoCards ? cell : panel;
      var to = intoCards ? panel : cell;
      var detail = $('.detail', from);
      if (detail && !$('.detail', to)) to.appendChild(detail);
    });
  }
  function placeForScreen() { placeDetails(!!(cardsQuery && cardsQuery.matches)); }
  if (hasBoard) {
    placeForScreen();
    if (cardsQuery) {
      if (cardsQuery.addEventListener) cardsQuery.addEventListener('change', placeForScreen);
      else if (cardsQuery.addListener) cardsQuery.addListener(placeForScreen);
    }
    window.addEventListener('beforeprint', function () { placeDetails(false); });
    window.addEventListener('afterprint', placeForScreen);
  }

  var q = $('#q');
  var sortField = $('#sort-field');
  var sortDirBtn = $('#sort-dir');
  var sortDirLabel = $('#sort-dir-label');
  var copyLink = $('#copy-link');
  var sortButtons = $$('button.th-sort[data-sort]');
  var chipBox = $('#model-chips');
  var chips = chipBox ? $$('button.chip[data-model]', chipBox) : [];
  var toggles = (CFG.toggles || ['tt', 'agile', 'gantt', 'calendar', 'caldav'])
    .map(function (key) { return { key: key, el: $('#f-' + key) }; })
    .filter(function (t) { return !!t.el; });
  var countEl = $('#result-count');
  var filterDisclosure = $('#filter-disclosure');
  var filterPanel = $('#filter-options');
  var filterDisclosureSummary = $('#filter-disclosure-summary');
  var emptyEl = $('#empty');
  var emptyTitle = $('#empty-title');
  var emptyText = $('#empty-text');
  var emptyActive = $('#empty-active');
  var emptyClear = $('#empty-clear');

  var tbody = rows.length ? rows[0].parentNode : null;
  var cardBox = cards.length ? cards[0].parentNode : null;

  function secondaryFilterCount() {
    var checked = toggles.filter(function (t) { return t.el.checked; }).length;
    var pressed = chips.filter(function (c) {
      return c.getAttribute('aria-pressed') === 'true';
    }).length;
    return checked + pressed;
  }

  function syncFilterDisclosure() {
    if (!filterDisclosure || !filterPanel) return;
    var active = secondaryFilterCount();
    var open = filterPanel.classList.contains('is-open');
    if (filterDisclosureSummary) {
      var resultText = countEl ? countEl.textContent.trim() : (CFG.filterSummary || 'Features & licensing');
      var visible = resultText.split(' of ')[0].split(' ')[0];
      filterDisclosureSummary.textContent = active
        ? active + ' active · ' + visible + ' results'
        : resultText;
    }
    filterDisclosure.setAttribute('aria-expanded', String(open));
    filterDisclosure.setAttribute('aria-label', (open ? 'Hide' : 'Show')
      + ' ' + (CFG.filterNoun || 'feature and licensing filters') + (active ? ', ' + active + ' active' : ''));
  }

  if (filterDisclosure && filterPanel) {
    filterDisclosure.addEventListener('click', function () {
      filterPanel.classList.toggle('is-open');
      syncFilterDisclosure();
    });
    syncFilterDisclosure();
  }

  /* --- ordered colour cues --- */
  // Star counts span two orders of magnitude, so equal linear bands would put
  // almost the whole directory in the first colour. These memorable thresholds
  // approximate a logarithmic scale while staying stable as projects are added.
  // The raw number remains visible: colour reinforces magnitude, never replaces it.
  function starGrade(value) {
    if (value < 1000) return 1;
    if (value < 5000) return 2;
    if (value < 15000) return 3;
    if (value < 40000) return 4;
    return 5;
  }

  rows.concat(cards).forEach(function (record) {
    var stars = num(record, 'stars');
    var value = $('.cell-stars .num, .card-meta .num', record);
    if (!value || !isFinite(stars)) return;
    value.setAttribute('data-grade', String(starGrade(stars)));
  });

  var KEYS = { name: 1, avg: 1, deploy: 1, use: 1, enterprise: 1, flex: 1,
    sovereignty: 1, portability: 1, community: 1, stars: 1, integrations: 1,
    year: 1 };
  merge(KEYS, CFG.keys);
  // Community size is the default order: it is the one column on a collapsed
  // row that speaks to whether a team can get help, and unlike the mean it is
  // not a ranking anyone can mistake for one. Stars sit beside it as a column
  // and a sort, never as the default: the band is the judgement, the count is
  // one of the signals behind it.
  var sortKey = 'community', sortDir = 'desc', terms = [];
  var DEFAULT_SORT = 'community-desc';
  // The direction button speaks in the field's own words: a reader sorting
  // by name is choosing A to Z, not "descending".
  var DIR_WORDS = {
    name: ['A to Z', 'Z to A'],
    year: ['Newest first', 'Oldest first'],
    community: ['Large to small', 'Small to large'],
    stars: ['Many to few', 'Few to many'],
    integrations: ['Many to few', 'Few to many']
  };
  merge(DIR_WORDS, CFG.dirWords);
  function dirWords(key, dir) {
    var pair = DIR_WORDS[key] || ['High to low', 'Low to high'];
    if (ascFirst(key)) return dir === 'asc' ? pair[0] : pair[1];
    return dir === 'desc' ? pair[0] : pair[1];
  }
  // A fresh field opens on the order a reader most likely wants: most, best
  // or newest first - except names, which read forwards.
  // A price reads cheapest first, the way a name reads A to Z.
  var ASC_KEYS = merge({ name: 1 }, CFG.ascKeys);
  function ascFirst(key) { return !!ASC_KEYS[key]; }
  function defaultDir(key) { return ascFirst(key) ? 'asc' : 'desc'; }
  // Which record is open, for the address bar. One slug: the most recent.
  var openSlug = null;
  var TOGGLE_NAMES = { tt: 'Time tracking', agile: 'Agile boards', gantt: 'Gantt',
    calendar: 'Calendar', caldav: 'CalDAV' };
  merge(TOGGLE_NAMES, CFG.toggleNames);

  /* --- the lead score column ---
   * The matrix shows one score. It is the mean by default, but sorting by a
   * criterion would otherwise reorder the table against a number that is not
   * on screen, so the column follows the sort: label, value, gauge and
   * screen-reader text all switch to the active criterion and back. Community
   * feeds the mean as a seventh input but is a band, not a criterion, and
   * integrations is neither; both carry columns of their own, so they leave
   * this one on the mean. */
  // `title` is the method: what the score was read from, and that it is a
  // judgement. The header tooltip carries it, so the column explains itself
  // whichever criterion it is currently showing.
  var CRIT_TAIL = ' Assessed against the published criteria; the expanded record includes the reasoning and research confidence.';
  var CRIT = {
    avg:         { head: 'Score',  title: 'Unweighted mean of seven scores: the six criteria, each scored 1-5 by reading documentation, repositories and release histories, and community size, its band read as 1 (small) to 5 (very large). An editorial judgement, not a benchmark. Expand a row for all seven and the reasoning behind each one.', sr: 'Mean of the six criteria and community size' },
    deploy:      { head: 'Deploy', title: 'Ease of deployment, 1-5: containers and packages, dependency count, operational complexity, upgrade burden and the state of the documentation.' + CRIT_TAIL, sr: 'Ease of deployment' },
    use:         { head: 'Use',    title: 'Ease of use, 1-5: interface clarity, learning curve, conceptual overhead, and whether non-specialists can live in it.' + CRIT_TAIL, sr: 'Ease of use' },
    enterprise:  { head: 'Ent',    title: 'Enterprise features, 1-5: permissions, identity, audit and governance, portfolio reporting, scalability and administration.' + CRIT_TAIL, sr: 'Enterprise features' },
    flex:        { head: 'Flex',   title: 'Interface flexibility, 1-5: how many genuinely useful views exist, plus workflow and custom-field options, dashboards, filters and extension points.' + CRIT_TAIL, sr: 'Interface flexibility' },
    sovereignty: { head: 'Sov',    title: 'Data sovereignty, 1-5: whether you can run it independently, read its source, and keep control of the application and the data under it.' + CRIT_TAIL, sr: 'Data sovereignty' },
    portability: { head: 'Port',   title: 'Portability, 1-5: APIs and exports, conventional storage and database choices, licensing constraints, and how realistically you could leave.' + CRIT_TAIL, sr: 'Portability' }
  };
  if (CFG.crit) for (var ck in CFG.crit) {
    if (Object.prototype.hasOwnProperty.call(CFG.crit, ck)) {
      CRIT[ck] = CFG.crit[ck];
      if (CFG.critTail && ck !== 'avg') CRIT[ck].title += CFG.critTail;
    }
  }
  var leadLabel = $('.th-lead-l');
  var leadButton = $('.th-lead .th-sort');
  var leadCells = $$('[data-score]');
  var cardLabels = $$('[data-score-label]');
  var leadKey = null;

  function setLead(key) {
    var spec = CRIT[key] || CRIT.avg;
    if (!CRIT[key]) key = 'avg';
    if (key === leadKey) return;
    leadKey = key;

    if (leadLabel) {
      leadLabel.textContent = spec.head;
      // The heading tooltips are lifted out of title= into data-method (see
      // § token tooltips). This column rewrites its own, so it writes the
      // attribute the tooltip reads and drops the one the browser would
      // otherwise draw a second, unstyled tip from.
      leadLabel.removeAttribute('title');
      leadLabel.setAttribute('data-method', spec.title);
    }
    // The header button must sort what the header now shows, or clicking it
    // would jump the column back to the mean without warning.
    if (leadButton) leadButton.setAttribute('data-sort', key);
    // On a card the score rides the project's name, so the label is spent
    // width. The mean needs none — the gauge is the label — and it only
    // appears when the sort has moved the score onto a criterion, where the
    // full name is worth the two lines it wraps to. The screen-reader text
    // below names the criterion either way, so nothing is lost when it goes.
    cardLabels.forEach(function (el) {
      el.textContent = key === 'avg' ? 'Score' : spec.sr;
      if (key === 'avg') el.removeAttribute('data-crit');
      else el.setAttribute('data-crit', '');
    });

    leadCells.forEach(function (el) {
      var host = closest(el, '.matrix-row, .card');
      if (!host) return;
      var v = num(host, key);
      if (v === -Infinity) return;
      var txt = v.toFixed(1);
      var numEl = $('.score-num', el);
      if (numEl) numEl.textContent = txt;
      el.style.setProperty('--fill', String(Math.max(0, Math.min(1, (v - 1) / 4)).toFixed(2)));
      var sr = el.parentNode ? $('[data-score-sr]', el.parentNode) : null;
      if (sr) sr.textContent = spec.sr + ': ' + txt + ' out of 5';
    });
  }

  // The detail row is normally the next sibling, but aria-controls is the
  // contract's authority on ownership, so prefer it and fall back.
  function detailOf(row) {
    var btn = $('button.row-expand', row);
    var el = btn ? document.getElementById(btn.getAttribute('aria-controls') || '') : null;
    if (el) return el;
    var next = row.nextElementSibling;
    return next && next.classList.contains('detail-row') ? next : null;
  }

  function isOpen(host) {
    var btn = $('button.row-expand, button.card-expand', host);
    return !!btn && btn.getAttribute('aria-expanded') === 'true';
  }
  function collapse(host) {
    var btn = $('button.row-expand, button.card-expand', host);
    if (!btn) return;
    btn.setAttribute('aria-expanded', 'false');
    var panel = document.getElementById(btn.getAttribute('aria-controls') || '');
    if (panel) setShown(panel, false);
  }
  function expand(host) {
    var btn = $('button.row-expand, button.card-expand', host);
    if (!btn) return;
    btn.setAttribute('aria-expanded', 'true');
    var panel = document.getElementById(btn.getAttribute('aria-controls') || '');
    if (panel) setShown(panel, true);
  }
  function hostOf(btn) { return closest(btn, 'tr.matrix-row, article.card'); }
  function slugOf(host) { return host ? host.getAttribute('data-slug') || null : null; }
  // The matrix and the cards are the same twenty-five records twice; which of
  // the two is on screen depends on the viewport. Opening a record by slug
  // opens both copies, so the state survives a rotation or a resize.
  function recordsOf(slug) {
    return rows.concat(cards).filter(function (h) { return slugOf(h) === slug; });
  }
  function visibleOf(hosts) {
    for (var i = 0; i < hosts.length; i++) {
      if (hosts[i].offsetParent !== null || hosts[i].getClientRects().length) return hosts[i];
    }
    return null;
  }

  function matches(el) {
    var i, hay = str(el, 'search');
    for (i = 0; i < terms.length; i++) if (hay.indexOf(terms[i]) === -1) return false;
    for (i = 0; i < toggles.length; i++) {
      // Checked = NATIVE only (2). Partial (1) means the capability sits behind
      // a paid tier, a plugin or an add-on, so it must not satisfy a
      // must-have — that is the precise confusion this directory exists to
      // prevent, and counting it here would contradict the cell beside it.
      if (toggles[i].el.checked && num(el, toggles[i].key) < 2) return false;
    }
    var pressed = chips.filter(function (c) {
      return c.getAttribute('aria-pressed') === 'true';
    });
    if (!pressed.length) return true; // none pressed = no licensing filter
    var model = str(el, 'model');
    return pressed.some(function (c) {
      return (c.getAttribute('data-model') || '').toLowerCase() === model;
    });
  }

  function compare(a, b) {
    var d = sortDir === 'asc' ? 1 : -1;
    if (sortKey === 'name') return d * str(a, 'name').localeCompare(str(b, 'name'));
    var va = num(a, sortKey), vb = num(b, sortKey);
    // A record with no figure (a quote-only price) has nothing to rank by:
    // it goes to the end whichever way the column is read.
    if (va === -Infinity || vb === -Infinity) {
      if (va !== vb) return va === -Infinity ? 1 : -1;
    } else if (va !== vb) return d * (va - vb);
    // Stable, predictable tiebreak: alphabetical, regardless of direction.
    return str(a, 'name').localeCompare(str(b, 'name'));
  }

  // Only touch the DOM when the order actually differs: apply() runs on every
  // keystroke, and re-appending every row would force a full relayout each time.
  function reorder(container, ordered) {
    if (!container) return;
    var kids = container.children, same = kids.length === ordered.length, i;
    for (i = 0; same && i < ordered.length; i++) if (kids[i] !== ordered[i]) same = false;
    if (same) return;
    var frag = document.createDocumentFragment();
    for (i = 0; i < ordered.length; i++) frag.appendChild(ordered[i]);
    container.appendChild(frag);
  }

  var lastCount = null;
  function announce(visible, total) {
    if (!countEl) return;
    var noun = total === 1 ? (CFG.noun || ['project'])[0] : (CFG.noun || [null, 'projects'])[1];
    var text = (visible === total ? total : visible + ' of ' + total) + ' ' + noun;
    // #result-count is aria-live: rewriting identical text re-announces it, so
    // write only when the number has genuinely changed.
    if (text === lastCount || text === countEl.textContent) { lastCount = text; return; }
    lastCount = text;
    countEl.textContent = text;
  }

  function apply() {
    if (!hasBoard) return;
    var visible = 0;

    var sortedRows = rows.slice().sort(compare);
    sortedRows.forEach(function (row) {
      var show = matches(row);
      if (show) visible++;
      setShown(row, show);
      var detail = detailOf(row);
      if (!show) {
        // A filtered-out row must not strand its detail on screen, and should
        // come back collapsed rather than mid-expansion.
        collapse(row);
        setShown(detail, false);
      } else if (detail) {
        setShown(detail, isOpen(row));
      }
    });

    // Detail rows are sibling <tr>s, not children of their owner, so reordering
    // must carry each one along or the table would shuffle details away from
    // the rows they describe.
    var flat = [];
    sortedRows.forEach(function (row) {
      flat.push(row);
      var d = detailOf(row);
      if (d && d.parentNode === tbody) flat.push(d);
    });
    // Keep any tbody children we do not manage (e.g. a spanning note row).
    Array.prototype.forEach.call(tbody ? tbody.children : [], function (el) {
      if (flat.indexOf(el) === -1) flat.push(el);
    });
    reorder(tbody, flat);

    var cardVisible = 0, sortedCards = cards.slice().sort(compare);
    sortedCards.forEach(function (card) {
      var show = matches(card);
      if (show) cardVisible++;
      else collapse(card);
      setShown(card, show);
    });
    reorder(cardBox, sortedCards);

    var total = rows.length || cards.length;
    var shown = rows.length ? visible : cardVisible;
    announce(shown, total);
    syncFilterDisclosure();
    if (emptyEl) emptyEl.hidden = shown !== 0;
    if (shown === 0) renderEmpty();
    // Hide the table chrome too: a thead over an empty body leaves ten sort
    // controls in the tab order that have nothing to sort.
    var scroller = $('.matrix-scroll');
    if (scroller) setShown(scroller, shown !== 0);

    // Filtering changes which rows the table lays its columns out against, so
    // which blurbs are cut is answered again after every pass.
    markClamped();
    writeURL();
  }

  /* --- the view in the address bar ---
   * Search, filters, sort and the open record are written into the query
   * string as they change, with replaceState so the back button is never
   * spent on a keystroke. Reading them back on load is what makes a filtered
   * view a thing you can bookmark, share or refresh. */
  var hasParams = typeof URLSearchParams !== 'undefined';
  function activeToggles() {
    return toggles.filter(function (t) { return t.el.checked; });
  }
  function pressedChips() {
    return chips.filter(function (c) { return c.getAttribute('aria-pressed') === 'true'; });
  }
  function viewParams() {
    var p = new URLSearchParams();
    var query = q ? q.value.trim() : '';
    if (query) p.set('q', query);
    var f = activeToggles().map(function (t) { return t.key; });
    if (f.length) p.set('f', f.join(','));
    var l = pressedChips().map(function (c) { return c.getAttribute('data-model'); });
    if (l.length) p.set('lic', l.join(','));
    if (sortKey + '-' + sortDir !== DEFAULT_SORT) p.set('sort', sortKey + '-' + sortDir);
    if (openSlug) p.set('open', openSlug);
    return p;
  }
  function writeURL() {
    if (!hasBoard || !hasParams || !window.history || !window.history.replaceState) return;
    var search = viewParams().toString();
    var next = window.location.pathname + (search ? '?' + search : '') + window.location.hash;
    var now = window.location.pathname + window.location.search + window.location.hash;
    if (next !== now) {
      try { window.history.replaceState(null, '', next); } catch (e) { /* file:// */ }
    }
    syncCopyLink(!!search);
  }
  function readURL() {
    if (!hasParams) return null;
    var p;
    try { p = new URLSearchParams(window.location.search); } catch (e) { return null; }
    if (q && p.get('q')) q.value = p.get('q');
    var f = (p.get('f') || '').split(',');
    toggles.forEach(function (t) { if (f.indexOf(t.key) > -1) t.el.checked = true; });
    var l = (p.get('lic') || '').split(',');
    chips.forEach(function (c) {
      if (l.indexOf(c.getAttribute('data-model')) > -1) c.setAttribute('aria-pressed', 'true');
    });
    var sort = String(p.get('sort') || '').split('-');
    if (KEYS[sort[0]]) { sortKey = sort[0]; sortDir = sort[1] === 'asc' ? 'asc' : 'desc'; }
    return p.get('open') || null;
  }

  /* --- copy link ---
   * Shown only when the address bar holds something worth handing over. The
   * confirmation is in the button itself, where the eye already is. */
  var copyTimer = null;
  function syncCopyLink(show) {
    if (!copyLink) return;
    copyLink.hidden = !show;
    if (!show && copyTimer) { window.clearTimeout(copyTimer); copyTimer = null; }
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      if (ok) resolve(); else reject(new Error('copy failed'));
    });
  }
  if (copyLink) {
    var copyIdle = copyLink.textContent;
    copyLink.addEventListener('click', function () {
      copyText(window.location.href).then(function () {
        copyLink.setAttribute('data-state', 'copied');
        copyLink.textContent = 'Link copied';
      }, function () {
        copyLink.setAttribute('data-state', 'failed');
        copyLink.textContent = 'Copy from the address bar';
      }).then(function () {
        if (copyTimer) window.clearTimeout(copyTimer);
        copyTimer = window.setTimeout(function () {
          copyLink.removeAttribute('data-state');
          copyLink.textContent = copyIdle;
          copyTimer = null;
        }, 1800);
      });
    });
  }

  /* --- the empty state names its cause ---
   * A search term, a set of filters, or both emptied the list; the copy says
   * which, and every active constraint is laid out as a token that removes
   * itself, so loosening is one tap rather than a hunt back up the rail. */
  function token(kind, name, remove) {
    var li = document.createElement('li');
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'empty-token';
    var k = document.createElement('span');
    k.className = 'empty-token-kind';
    k.textContent = kind + ':';
    var n = document.createElement('span');
    n.textContent = name;
    var x = document.createElement('span');
    x.className = 'empty-token-x';
    x.setAttribute('aria-hidden', 'true');
    b.appendChild(k);
    b.appendChild(n);
    b.appendChild(x);
    b.setAttribute('aria-label', 'Remove ' + kind.toLowerCase() + ' ' + name);
    b.addEventListener('click', function () { remove(); apply(); });
    li.appendChild(b);
    return li;
  }
  function renderEmpty() {
    if (!emptyEl) return;
    var query = q ? q.value.trim() : '';
    var on = activeToggles();
    var lic = pressedChips();
    var filters = on.length + lic.length;
    var title, text, action;
    if (query && !filters) {
      title = 'Nothing matches \u201C' + query + '\u201D';
      text = (CFG.empty && CFG.empty.search) || 'The search reads names, licences and the one-line descriptions. Try a shorter word, a licence such as MIT or AGPL, or clear it and browse.';
      action = 'Clear search';
    } else if (!query && filters) {
      title = (CFG.empty && CFG.empty.filtersTitle) || 'No project matches those filters';
      text = (CFG.empty && CFG.empty.filters) || 'Asking for native time tracking, Gantt, a calendar and CalDAV under a single licensing model rules out nearly everything, and partial support never satisfies a must-have. Loosen one filter and try again.';
      // Name the constraints actually set, not a generic list that may
      // include filters the reader never touched.
      if (CFG.empty && CFG.empty.dynamic) {
        var inline = CFG.empty.inline || {};
        var want = on.map(function (t) { return inline[t.key] || (TOGGLE_NAMES[t.key] || t.key); });
        var aud = lic.map(function (c) {
          var k = c.getAttribute('data-model');
          return (CFG.empty.audience || {})[k] || c.textContent.trim();
        });
        var listed = want.length > 1
          ? want.slice(0, -1).join(', ') + ' and ' + want[want.length - 1]
          : want.join('');
        text = (listed ? 'No product here has ' + listed + (aud.length ? ' and is built for ' + aud.join(' or ') : '')
                       : 'No product here is built for ' + aud.join(' or ') + ' with those filters')
          + '. Partial support never satisfies a must-have. Remove one constraint below.';
      }
      action = 'Clear filters';
    } else {
      title = 'Nothing matches \u201C' + query + '\u201D with those filters';
      text = 'The search and the filters are both narrowing the list. Take one constraint off below, or clear them all.';
      action = 'Clear search and filters';
    }
    if (emptyTitle) emptyTitle.textContent = title;
    if (emptyText) emptyText.textContent = text;
    if (emptyClear) emptyClear.textContent = action;
    if (!emptyActive) return;
    while (emptyActive.firstChild) emptyActive.removeChild(emptyActive.firstChild);
    if (query) {
      emptyActive.appendChild(token('Search', query, function () {
        if (q) q.value = '';
        terms = [];
      }));
    }
    on.forEach(function (t) {
      emptyActive.appendChild(token(CFG.toggleToken || 'Native', TOGGLE_NAMES[t.key] || t.key, function () {
        t.el.checked = false;
      }));
    });
    lic.forEach(function (c) {
      emptyActive.appendChild(token(CFG.chipToken || 'Licence', c.textContent.trim(), function () {
        c.setAttribute('aria-pressed', 'false');
      }));
    });
  }

  /* --- sort UI wiring --- */
  function syncSortUI() {
    if (sortField && sortField.value !== sortKey) {
      var exists = Array.prototype.some.call(sortField.options, function (o) {
        return o.value === sortKey;
      });
      // Never leave the select displaying a sort that is not in effect.
      if (exists) sortField.value = sortKey;
      else sortField.selectedIndex = -1;
    }
    if (sortDirBtn) {
      var words = dirWords(sortKey, sortDir);
      sortDirBtn.setAttribute('data-dir', sortDir);
      sortDirBtn.setAttribute('aria-label', 'Order: ' + words.toLowerCase() + '. Reverse the order');
      if (sortDirLabel) sortDirLabel.textContent = words;
    }
    sortButtons.forEach(function (btn) {
      var th = closest(btn, 'th');
      var active = btn.getAttribute('data-sort') === sortKey;
      // aria-sort is cleared on every other header, not just set on this one.
      if (th) th.setAttribute('aria-sort', !active ? 'none'
        : (sortDir === 'asc' ? 'ascending' : 'descending'));
      if (btn.hasAttribute('aria-pressed')) btn.setAttribute('aria-pressed', String(active));
    });
  }

  function setSort(key, dir) {
    if (!KEYS[key]) return;
    sortKey = key;
    sortDir = dir === 'asc' ? 'asc' : 'desc';
    setLead(key);
    syncSortUI();
    apply();
  }

  if (sortField) {
    sortField.addEventListener('change', function () {
      setSort(sortField.value, defaultDir(sortField.value));
    });
  }
  if (sortDirBtn) {
    sortDirBtn.addEventListener('click', function () {
      setSort(sortKey, sortDir === 'desc' ? 'asc' : 'desc');
    });
  }

  sortButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-sort');
      // Contract: a header click cycles desc -> asc (and back to desc).
      // A second click reverses; a first click opens on the field's natural order.
      setSort(key, key === sortKey ? (sortDir === 'desc' ? 'asc' : 'desc') : defaultDir(key));
    });
  });

  /* --- filter UI wiring --- */
  function readQuery() {
    terms = q ? q.value.trim().toLowerCase().split(/\s+/).filter(Boolean) : [];
  }
  if (q) {
    var timer = null, run = function () { readQuery(); apply(); };
    q.addEventListener('input', function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(run, 120);
    });
    // Enter and the native type=search clear button should feel instant.
    q.addEventListener('search', function () { window.clearTimeout(timer); run(); });
    q.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { window.clearTimeout(timer); run(); }
    });
    readQuery();

    // "/" focuses the search box, the convention on every dense register a
    // developer already uses. Never steal the key from a field they are in.
    document.addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target;
      if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
      e.preventDefault();
      try { q.focus(); q.select(); } catch (err) { /* no-op */ }
    });
  }

  toggles.forEach(function (t) { t.el.addEventListener('change', apply); });

  if (chipBox) {
    chipBox.addEventListener('click', function (e) {
      var chip = closest(e.target, 'button.chip[data-model]');
      if (!chip || !chipBox.contains(chip)) return;
      chip.setAttribute('aria-pressed',
        chip.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      apply();
    });
  }

  function clearFilters() {
    if (q) q.value = '';
    terms = [];
    toggles.forEach(function (t) { t.el.checked = false; });
    chips.forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
    // Sort is a view preference, not a filter — deliberately left alone.
    apply();
    if (q) { try { q.focus(); } catch (e) { /* no-op */ } }
  }

  [$('#clear-filters'), $('#empty-clear')].forEach(function (b) {
    if (b) b.addEventListener('click', clearFilters);
  });

  /* --- expand/collapse --- */
  document.addEventListener('click', function (e) {
    var btn = closest(e.target, 'button.row-expand, button.card-expand');
    if (!btn) return;
    var panel = document.getElementById(btn.getAttribute('aria-controls') || '');
    if (!panel) return;
    var open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    setShown(panel, !open);
    var slug = slugOf(hostOf(btn));
    if (!open) openSlug = slug;
    else if (openSlug === slug) openSlug = null;
    writeURL();
  });

  /* --- a way back from the foot of a record --- */
  // Every record gets a close control at its end. It routes through the
  // record's own expander so the chevron, aria-expanded and the address bar
  // all stay owned by the one handler above, then brings the row back into
  // view, because the row is now a long way up.
  $$('.detail').forEach(function (detail) {
    if (!closest(detail, 'tr.detail-row') && !closest(detail, 'article.card')) return;
    var foot = document.createElement('p');
    foot.className = 'detail-foot';
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-ghost btn-sm detail-close';
    b.textContent = 'Close record';
    foot.appendChild(b);
    detail.appendChild(foot);
    b.addEventListener('click', function () {
      // Looked up on each click: the detail moves between row and card.
      var host = closest(detail, 'tr.detail-row') || closest(detail, 'article.card');
      var owner = !host ? null : host.classList.contains('card') ? host : host.previousElementSibling;
      var btn = owner && $('button.row-expand, button.card-expand', owner);
      if (!btn) return;
      btn.click();
      try {
        owner.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
        btn.focus({ preventScroll: true });
      } catch (err) { owner.scrollIntoView(); }
    });
  });

  /* --- a cut-off blurb opens its own row --- */
  // The matrix gives each blurb two lines and the browser draws the ellipsis at
  // the cut. That ellipsis is not an element and cannot take a listener, so the
  // clamped blurb is the target: click it and the row opens on the full summary
  // the blurb was an extract of. Only blurbs the browser actually cut are
  // marked — measured here rather than guessed from character counts, because
  // the cut moves with the column width, the font and the zoom level.
  function markClamped() {
    for (var i = 0; i < rows.length; i++) {
      var b = $('.project-blurb', rows[i]);
      if (!b) continue;
      var cut = b.scrollHeight - b.clientHeight > 1;
      b.classList.toggle('is-clamped', cut);
    }
  }

  document.addEventListener('click', function (e) {
    var blurb = closest(e.target, '.project-blurb.is-clamped');
    if (!blurb) return;
    // Dragging across the text to copy it is not a request to open anything.
    var sel = window.getSelection && window.getSelection();
    if (sel && String(sel).length) return;
    var row = closest(blurb, 'tr.matrix-row');
    var btn = row && $('button.row-expand', row);
    // Routed through the button so aria-expanded, the chevron and the panel all
    // stay owned by one handler.
    if (btn) btn.click();
  });

  var clampTimer = null;
  window.addEventListener('resize', function () {
    if (clampTimer) clearTimeout(clampTimer);
    clampTimer = setTimeout(markClamped, 150);
  });

  if (hasBoard) {
    // Detail panels are authored open so that, without JavaScript, the evidence
    // behind every score is still readable. Scripting collapses them on init.
    rows.concat(cards).forEach(collapse);
    // The address bar may already describe a view; take it before first paint
    // of the sorted table so there is no flash of the default order.
    var linkedSlug = readURL();
    // A bare #slug is the record's @id in the page's JSON-LD (…/#asana), so it
    // opens the record too. Section anchors (#faq) match no record and pass by.
    if (!linkedSlug && window.location.hash.length > 1) {
      var hashSlug = window.location.hash.slice(1);
      try { hashSlug = decodeURIComponent(hashSlug); } catch (e) { /* malformed */ }
      if (recordsOf(hashSlug).length) {
        linkedSlug = hashSlug;
        // writeURL will say ?open=slug; the hash would only repeat it.
        try { window.history.replaceState(null, '', window.location.pathname + window.location.search); }
        catch (e) { /* file:// */ }
      }
    }
    readQuery();
    setLead(sortKey);
    syncSortUI();
    if (linkedSlug) {
      var linked = recordsOf(linkedSlug);
      if (linked.length) {
        openSlug = linkedSlug;
        linked.forEach(expand);
      }
    }
    apply();
    if (openSlug) {
      // Bring the linked record into view once the layout has settled; the
      // open row is somewhere down a table that has just been sorted.
      window.setTimeout(function () {
        var target = visibleOf(recordsOf(openSlug));
        if (target) {
          try { target.scrollIntoView({ behavior: 'auto', block: 'start' }); }
          catch (err) { target.scrollIntoView(); }
        }
      }, 0);
    }
  }

  // The measurement is only true once the web font it was measured in has
  // arrived; before that the fallback face decides where the text is cut.
  if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
    document.fonts.ready.then(markClamped).catch(function () { /* no-op */ });
  }

  /* --- token tooltips --- */
  // Hover/focus explanations for what a collapsed row cannot spell out: the
  // licensing tag, the community-size band, every column heading's method, and
  // the dagger on a star count whose repository does not map onto the product. The copy lives here rather than in 44 duplicated title attributes;
  // §17 states all three licensing models in the HTML and the FAQ states what
  // the bands are not, so a reader without JavaScript loses nothing.
  // One shared node on <body>, fixed and JS-positioned, because the matrix is a
  // horizontal scroller and would clip a tooltip parented inside a cell.
  (function tokenTips() {
    var LIC = {
      'foss': 'The assessed software uses a recognised free and open-source licence. Paid hosting, support or GPL-licensed add-ons do not change that classification; FOSS does not mean every feature is available in the free edition.',
      'foss-app': 'A recognised free licence, but this is an app inside a host platform rather than a product that stands alone. Freedom over the code is full; the dependency you take on is the platform underneath it.',
      'open-core': 'An open-source core is offered alongside extensions or editions under proprietary or other non-open-source terms. The distinction is the licence of those additions, not whether the free edition feels complete.',
      'source-available': 'The assessed edition exposes source code under terms that restrict open-source freedoms, such as use, modification or redistribution. Read the licence and edition caveat; visible source and permission to self-host do not by themselves make software open source.'
    };
    // What puts a project in a band, and what the band means for a team that
    // will have to find its own answers. Deliberately no numbers: Redmine is
    // the reason — it sits in the top band on installed base and ecosystem
    // while its repository metrics read like a middle one, and a tooltip
    // quoting star counts would contradict the row it is attached to.
    var COMM = {
      '5': 'Many active contributors, a busy forum or chat, releases on a steady cadence, and an installed base large enough that almost anything you hit already has a public answer.',
      '4': 'A standing group of contributors, a live support channel and regular releases. Common problems are answered in public; the rarer ones still reach a maintainer.',
      '3': 'A small core team and predictable releases, with a narrower ecosystem around them. Answers exist, mostly in the issue tracker rather than in third-party writing.',
      '2': 'Development held by a few hands, and little written about the project elsewhere. Expect to read the source and open issues rather than find an answer waiting.',
      '1': 'Few contributors and irregular releases. Continuity is a risk you take on yourself.'
    };
    // Same tail on every band, written once: what the band is read from, and
    // the one thing no repository metric can stand in for.
    merge(LIC, CFG.lic);
    merge(COMM, CFG.comm);
    var COMM_TAIL = CFG.commTail != null ? CFG.commTail : ' Set by contributors, release cadence, forum activity, ecosystem and installed base together - never one metric, and never a count of deployments.';
    // Heading and dagger copy is authored in the HTML as title=, so a reader
    // without JavaScript still gets it from the browser. Lift it into
    // data-method here and take title= off, or both tips would open at once.
    $$('.methodology[title]').forEach(function (el) {
      el.setAttribute('data-method', el.getAttribute('title'));
      el.removeAttribute('title');
    });

    var GROUPS = [
      { sel: '.tag[data-lic]', attr: 'data-lic', text: LIC, tail: '' },
      { sel: '[data-comm]', attr: 'data-comm', text: COMM, tail: COMM_TAIL },
      // The attribute holds the copy itself rather than a key into a table.
      { sel: '[data-method]', attr: 'data-method', text: null, tail: '' }
    ];
    var SEL = GROUPS.map(function (g) { return g.sel; }).join(', ');
    var DELAY = 90; // sweeping a cursor along a row shouldn't flash tooltips
    var GAP = 8;    // trigger-to-tooltip
    var EDGE = 8;   // tooltip-to-viewport
    if (!$$(SEL).length) return;

    function raf(fn) {
      return window.requestAnimationFrame
        ? window.requestAnimationFrame(fn)
        : window.setTimeout(fn, 16);
    }

    // Which group a trigger belongs to, and therefore which copy it carries.
    function copyFor(el) {
      for (var i = 0; i < GROUPS.length; i++) {
        if (el.matches && el.matches(GROUPS[i].sel)) {
          var raw = el.getAttribute(GROUPS[i].attr);
          var body = GROUPS[i].text ? GROUPS[i].text[raw] : raw;
          return body ? body + GROUPS[i].tail : null;
        }
      }
      return null;
    }

    var tip = document.createElement('div');
    tip.className = 'tip';
    tip.id = 'token-tip';
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;
    var label = document.createElement('strong');
    label.className = 'tip-label';
    var body = document.createElement('span');
    tip.appendChild(label);
    tip.appendChild(body);
    document.body.appendChild(tip);

    var active = null;
    var timer = null;
    var pending = 0;

    function place() {
      if (!active) return;
      var r = active.getBoundingClientRect();
      // Trigger gone (filtered out, row collapsed) or scrolled out of the
      // viewport: a fixed tooltip would otherwise hang in empty space.
      if ((!r.width && !r.height) || r.bottom < 0 || r.top > window.innerHeight) {
        hide();
        return;
      }
      var w = tip.offsetWidth;
      var h = tip.offsetHeight;
      var side = 'top';
      var top = r.top - GAP - h;
      if (top < EDGE) {
        side = 'bottom';
        top = r.bottom + GAP;
      }
      var left = r.left + r.width / 2 - w / 2;
      left = Math.max(EDGE, Math.min(left, window.innerWidth - w - EDGE));
      tip.style.top = Math.round(top) + 'px';
      tip.style.left = Math.round(left) + 'px';
      tip.setAttribute('data-side', side);
      // The arrow tracks the trigger, not the box, which may have been clamped.
      var ax = r.left + r.width / 2 - left;
      tip.style.setProperty(
        '--arrow-x',
        Math.round(Math.max(10, Math.min(ax, w - 10))) + 'px'
      );
    }

    function show(el) {
      var copy = copyFor(el);
      if (!copy) return;
      active = el;
      // A dagger is not a heading: it names the column it qualifies instead.
      label.textContent = el.getAttribute('data-tip-label') || el.textContent;
      body.textContent = copy;
      tip.setAttribute('data-enter', '0');
      tip.hidden = false;
      // Described before positioned: place() may decide the trigger is off
      // screen and hide(), and hide() is what takes the attribute back off.
      el.setAttribute('aria-describedby', tip.id);
      place();
      // Measured and positioned first, then faded in — never the reverse.
      raf(function () { if (active === el) tip.setAttribute('data-enter', '1'); });
    }

    function hide() {
      if (timer) { window.clearTimeout(timer); timer = null; }
      if (!active) return;
      active.removeAttribute('aria-describedby');
      active = null;
      tip.hidden = true;
      tip.removeAttribute('data-enter');
    }

    document.addEventListener('mouseover', function (e) {
      var el = closest(e.target, SEL);
      if (!el || el === active) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(function () { timer = null; show(el); }, DELAY);
    });

    document.addEventListener('mouseout', function (e) {
      var el = closest(e.target, SEL);
      if (!el) return;
      if (e.relatedTarget && closest(e.relatedTarget, SEL) === el) return;
      if (timer) { window.clearTimeout(timer); timer = null; }
      // Keep it up if the same tag is also keyboard-focused.
      if (el === active && el !== document.activeElement) hide();
    });

    // Keyboard and assistive tech: tags are focusable, and focus shows at once.
    document.addEventListener('focusin', function (e) {
      var el = closest(e.target, SEL);
      if (el) show(el);
      else if (active) hide();
    });

    document.addEventListener('focusout', function (e) {
      if (closest(e.target, SEL) === active) hide();
    });

    document.addEventListener('keydown', function (e) {
      if (active && (e.key === 'Escape' || e.key === 'Esc')) hide();
    });

    function reposition() {
      if (!active || pending) return;
      pending = raf(function () { pending = 0; place(); });
    }

    // Capture phase: the matrix scrolls inside its own box, not the window.
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
  })();

  /* --- nav --- */
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = closest(e.target, 'a[href^="#"]');
    if (!a) return;
    var id = (a.getAttribute('href') || '').slice(1);
    var target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    try {
      target.scrollIntoView({
        behavior: reduceMotion.matches ? 'auto' : 'smooth',
        block: 'start'
      });
    } catch (err) { target.scrollIntoView(); }
    // Send the keyboard where the eye went, without a second jump.
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    try { target.focus({ preventScroll: true }); } catch (err) { /* no-op */ }
    if (window.history && window.history.pushState) {
      // Keep the view: the hash names a section, the query names the state.
      window.history.pushState(null, '', window.location.search + '#' + id);
    }
  });

  /* --- hero mark ripple --- */
  // Plays once: the stroke is cut into blocks of its own width, and a wave
  // closes in on the centre of the mark from every side at once, like a
  // ring of water contracting. A block's timing is its distance from the
  // centre, so the whole outer ring rises together, the front then runs in
  // along both legs, and the inner ring rises last. A block is the stroke
  // itself (same ink); it "rises" by swelling a touch in place rather than
  // moving in any direction, so nothing appears to crawl along the line.
  // Page-coloured joints show while it is raised. Purely decorative: skipped
  // under reduced motion, when the mark is not displayed, or without the SVG
  // geometry API. Styles live under .hero-mark-ripple in style.css.
  (function heroRipple() {
    if (reduceMotion.matches) return;
    var svg = $('.hero-mark-svg');
    var path = svg && $('path', svg);
    if (!path || typeof path.getTotalLength !== 'function') return;
    if (window.getComputedStyle(svg.parentNode).display === 'none') return;

    var NS = 'http://www.w3.org/2000/svg';
    var WIDTH = 58;            // just under the 63-unit stroke, so on the
                               // tight inner ring a block's corners stay
                               // inside the outline instead of ticking past it
    var OVERLAP = 4;           // blocks overlap slightly so curves show no seams
    var STEP = 84;             // target block length along the stroke
    var CENTRE = { x: 731, y: 731 };  // shared centre of both rings
    var R_OUT = 698;           // outer ring radius: where the wave starts
    var R_IN = 253.5;          // inner ring radius: where it closes
    var TRAVEL = 800;          // ms for the front to go from R_OUT to R_IN
    var BLOCK = 600;           // ms per block; matches the CSS animation

    function place(el, x, y, deg) {
      el.setAttribute('transform',
        'translate(' + x.toFixed(2) + ' ' + y.toFixed(2) + ') rotate(' + deg.toFixed(2) + ')');
      return el;
    }

    var layer = document.createElementNS(NS, 'g');
    layer.setAttribute('class', 'hero-mark-ripple');
    var last = 0;
    try {
      var total = path.getTotalLength();
      var n = Math.max(1, Math.round(total / STEP));
      var step = total / n;
      var len = step + OVERLAP;
      for (var i = 0; i < n; i++) {
        var s = (i + 0.5) * step;
        var p = path.getPointAtLength(s);
        var a = path.getPointAtLength(Math.max(0, s - 2));
        var b = path.getPointAtLength(Math.min(total, s + 2));
        var deg = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
        var r = Math.sqrt(Math.pow(p.x - CENTRE.x, 2) + Math.pow(p.y - CENTRE.y, 2));
        var inward = Math.min(1, Math.max(0, (R_OUT - r) / (R_OUT - R_IN)));
        var delay = Math.round(inward * TRAVEL);
        last = Math.max(last, delay);

        // <g swells> face + joint </g>, swelling about the block's centre.
        var block = document.createElementNS(NS, 'g');
        block.setAttribute('class', 'hero-mark-block');
        block.setAttribute('style', '--d:' + delay + 'ms');

        var face = document.createElementNS(NS, 'rect');
        face.setAttribute('class', 'hero-mark-face');
        face.setAttribute('x', String(-len / 2));
        face.setAttribute('y', String(-WIDTH / 2));
        face.setAttribute('width', String(len));
        face.setAttribute('height', String(WIDTH));
        block.appendChild(place(face, p.x, p.y, deg));

        // The joint: a hairline across the block's leading end only, the
        // stroke's width and no longer, so it marks the block without ever
        // running along (and tracing) the outline. Blocks are drawn in path
        // order, so it lands on the previous block's overlapping end.
        var seam = document.createElementNS(NS, 'line');
        var sx = String(-len / 2 + OVERLAP / 2);
        seam.setAttribute('class', 'hero-mark-seam');
        seam.setAttribute('x1', sx);
        seam.setAttribute('x2', sx);
        seam.setAttribute('y1', String(-WIDTH / 2));
        seam.setAttribute('y2', String(WIDTH / 2));
        block.appendChild(place(seam, p.x, p.y, deg));

        layer.appendChild(block);
      }
    } catch (e) { return; }
    if (!layer.firstChild) return;

    function play() {
      svg.appendChild(layer);
      window.setTimeout(function () {
        if (layer.parentNode) layer.parentNode.removeChild(layer);
      }, last + BLOCK + 100);
    }

    // Wait for the page to settle, and for the mark to actually be on screen.
    function arm() {
      window.setTimeout(function () {
        if (!('IntersectionObserver' in window)) { play(); return; }
        var io = new IntersectionObserver(function (entries) {
          if (!entries[0].isIntersecting) return;
          io.disconnect();
          play();
        }, { threshold: 0.6 });
        io.observe(svg);
      }, 450);
    }
    if (document.readyState === 'complete') arm();
    else window.addEventListener('load', arm, { once: true });
  })();

  (function navCurrent() {
    if (!('IntersectionObserver' in window)) return;
    var links = $$('.site-header nav a[href^="#"]');
    if (!links.length) links = $$('header nav a[href^="#"]');
    var map = [];
    links.forEach(function (a) {
      var t = document.getElementById((a.getAttribute('href') || '').slice(1));
      if (t) map.push({ link: a, target: t });
    });
    if (!map.length) return;
    var seen = Object.create(null);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { seen[en.target.id] = en.isIntersecting; });
      var active = null;
      map.forEach(function (m) { if (!active && seen[m.target.id]) active = m.link; });
      map.forEach(function (m) {
        if (m.link === active) m.link.setAttribute('aria-current', 'location');
        else m.link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    map.forEach(function (m) { io.observe(m.target); });
  })();
})();
