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

  var q = $('#q');
  var sortSelect = $('#sort');
  var sortButtons = $$('button.th-sort[data-sort]');
  var chipBox = $('#model-chips');
  var chips = chipBox ? $$('button.chip[data-model]', chipBox) : [];
  var toggles = ['tt', 'agile', 'gantt', 'calendar', 'caldav']
    .map(function (key) { return { key: key, el: $('#f-' + key) }; })
    .filter(function (t) { return !!t.el; });
  var countEl = $('#result-count');
  var filterDisclosure = $('#filter-disclosure');
  var filterPanel = $('#filter-options');
  var filterDisclosureSummary = $('#filter-disclosure-summary');
  var emptyEl = $('#empty');

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
      var resultText = countEl ? countEl.textContent.trim() : 'Features & licensing';
      var visible = resultText.split(' of ')[0].split(' ')[0];
      filterDisclosureSummary.textContent = active
        ? active + ' active · ' + visible + ' results'
        : resultText;
    }
    filterDisclosure.setAttribute('aria-expanded', String(open));
    filterDisclosure.setAttribute('aria-label', (open ? 'Hide' : 'Show')
      + ' feature and licensing filters' + (active ? ', ' + active + ' active' : ''));
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
    sovereignty: 1, portability: 1, community: 1, stars: 1, integrations: 1 };
  // Community size is the default order: it is the one column on a collapsed
  // row that speaks to whether a team can get help, and unlike the mean it is
  // not a ranking anyone can mistake for one. Stars sit beside it as a column
  // and a sort, never as the default: the band is the judgement, the count is
  // one of the signals behind it.
  var sortKey = 'community', sortDir = 'desc', terms = [];

  /* --- the lead score column ---
   * The matrix shows one score. It is the mean by default, but sorting by a
   * criterion would otherwise reorder the table against a number that is not
   * on screen, so the column follows the sort: label, value, gauge and
   * screen-reader text all switch to the active criterion and back. Community
   * and integrations are not criteria and carry columns of their own, so they
   * leave this one on the mean. */
  // `title` is the method: what the score was read from, and that it is a
  // judgement. The header tooltip carries it, so the column explains itself
  // whichever criterion it is currently showing.
  var CRIT_TAIL = ' Assessed against the published criteria; the expanded record includes the reasoning and research confidence.';
  var CRIT = {
    avg:         { head: 'Score',  title: 'Unweighted mean of the six criteria, each scored 1\u20135 by reading documentation, repositories and release histories. An editorial judgement, not a benchmark. Expand a row for the six scores and the reasoning behind each one.', sr: 'Mean of the six criteria' },
    deploy:      { head: 'Deploy', title: 'Ease of deployment, 1\u20135: containers and packages, dependency count, operational complexity, upgrade burden and the state of the documentation.' + CRIT_TAIL, sr: 'Ease of deployment' },
    use:         { head: 'Use',    title: 'Ease of use, 1\u20135: interface clarity, learning curve, conceptual overhead, and whether non-specialists can live in it.' + CRIT_TAIL, sr: 'Ease of use' },
    enterprise:  { head: 'Ent',    title: 'Enterprise features, 1\u20135: permissions, identity, audit and governance, portfolio reporting, scalability and administration.' + CRIT_TAIL, sr: 'Enterprise features' },
    flex:        { head: 'Flex',   title: 'Interface flexibility, 1\u20135: how many genuinely useful views exist, plus workflow and custom-field options, dashboards, filters and extension points.' + CRIT_TAIL, sr: 'Interface flexibility' },
    sovereignty: { head: 'Sov',    title: 'Data sovereignty, 1\u20135: whether you can run it independently, read its source, and keep control of the application and the data under it.' + CRIT_TAIL, sr: 'Data sovereignty' },
    portability: { head: 'Port',   title: 'Portability, 1\u20135: APIs and exports, conventional storage and database choices, licensing constraints, and how realistically you could leave.' + CRIT_TAIL, sr: 'Portability' }
  };
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
    // Cards have room for the full criterion name; the column header does not.
    cardLabels.forEach(function (el) { el.textContent = key === 'avg' ? 'Score' : spec.sr; });

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
    var delta = num(a, sortKey) - num(b, sortKey);
    if (delta !== 0) return d * delta;
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
    var noun = total === 1 ? 'project' : 'projects';
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
    // Hide the table chrome too: a thead over an empty body leaves ten sort
    // controls in the tab order that have nothing to sort.
    var scroller = $('.matrix-scroll');
    if (scroller) setShown(scroller, shown !== 0);

    // Filtering changes which rows the table lays its columns out against, so
    // which blurbs are cut is answered again after every pass.
    markClamped();
  }

  /* --- sort UI wiring --- */
  function syncSortUI() {
    var want = sortKey + '-' + sortDir;
    if (sortSelect && sortSelect.value !== want) {
      var exists = Array.prototype.some.call(sortSelect.options, function (o) {
        return o.value === want;
      });
      // Never leave the select displaying a sort that is not in effect.
      if (exists) sortSelect.value = want;
      else sortSelect.selectedIndex = -1;
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

  if (sortSelect) {
    var initial = String(sortSelect.value || 'community-desc').split('-');
    if (KEYS[initial[0]]) { sortKey = initial[0]; sortDir = initial[1] === 'asc' ? 'asc' : 'desc'; }
    // A restored or non-default select value must not leave the column showing
    // the mean while the table is ordered by something else.
    setLead(sortKey);
    sortSelect.addEventListener('change', function () {
      var parts = String(sortSelect.value || '').split('-');
      setSort(parts[0], parts[1]);
    });
  }

  sortButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-sort');
      // Contract: a header click cycles desc -> asc (and back to desc).
      setSort(key, (key === sortKey && sortDir === 'desc') ? 'asc' : 'desc');
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
    syncSortUI();
    apply();
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
    var COMM_TAIL = ' Set by contributors, release cadence, forum activity, ecosystem and installed base together \u2014 never one metric, and never a count of deployments.';
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
      window.history.pushState(null, '', '#' + id);
    }
  });

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
