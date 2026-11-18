/* Licence chooser. Questions are a decision tree over the fifteen instruments
   in #pick-catalogue. An answer keeps the licences named on that option;
   the next question is the first one that still splits what remains.
   No DOM work above the document check, so the tree can be walked in Node. */
(function (root) {
  'use strict';

  /* Spectrum order: what the author keeps, from every right to none. */
  var ORDER = [
    'proprietary', 'polyform', 'busl', 'elastic',
    'agpl', 'gpl3', 'gpl2', 'lgpl', 'mpl',
    'apache', 'bsd3', 'mit',
    'bsd0', 'unlicense', 'cc0'
  ];

  var QUESTIONS = [
    {
      id: 'who',
      ask: 'What may other people do with the code?',
      help: 'This is the cut that matters. Everything after it only sorts the licences on the side you chose.',
      options: [
        {
          id: 'who-private',
          short: 'Private',
          label: 'Nothing, unless you agree it in writing',
          detail: 'The code stays yours. There is no public licence. Publishing the files does not grant permission to use them.',
          ids: ['proprietary']
        },
        {
          id: 'who-restricted',
          short: 'Source, with a reservation',
          label: 'They may have the source, but you keep a use you still charge for',
          detail: 'Source-available. People can read the code. It is not an open-source licence, whatever a README calls it.',
          ids: ['polyform', 'busl', 'elastic']
        },
        {
          id: 'who-open',
          short: 'Open terms',
          label: 'They may use, change and share it, including in a product they sell',
          detail: 'An open-source licence, or a dedication with no conditions. You can still require them to share changes, or not.',
          ids: ['mpl', 'lgpl', 'gpl2', 'gpl3', 'agpl', 'mit', 'bsd3', 'apache', 'bsd0', 'unlicense', 'cc0']
        }
      ]
    },
    {
      id: 'hold',
      ask: 'Which use do you still want to charge for?',
      help: 'All three publish the source. None of them is an open-source licence.',
      options: [
        {
          id: 'hold-nc',
          short: 'No commercial use',
          label: 'Any commercial use',
          detail: 'Personal and research use is free. A company that wants to ship or sell the software needs a separate agreement from you.',
          ids: ['polyform']
        },
        {
          id: 'hold-prod',
          short: 'Production until a date',
          label: 'Production use, until a date you set, then an open licence takes over',
          detail: 'You publish now under terms that convert. You have to name the date, or accept the four-year fallback, and name the licence it becomes.',
          ids: ['busl']
        },
        {
          id: 'hold-service',
          short: 'No competing service',
          label: 'Offering your software to others as a hosted service',
          detail: 'They may run it in their own production, change it and ship those changes. They may not sell it as a managed service.',
          ids: ['elastic']
        }
      ]
    },
    {
      id: 'share',
      ask: 'What has to stay under your terms when someone builds on it?',
      help: 'Copyleft is a condition on sharing, not a ban on commercial use. A permissive licence lets a company take the code private.',
      options: [
        {
          id: 'share-none',
          short: 'Closed forks allowed',
          label: 'Nothing. A closed fork is fine',
          detail: 'They may ship a proprietary product built from your code. You decide only what notice, if any, travels with the copy.',
          ids: ['mit', 'bsd3', 'apache', 'bsd0', 'unlicense', 'cc0']
        },
        {
          id: 'share-files',
          short: 'File copyleft',
          label: 'Your files. Their other files can be under any licence',
          detail: 'Changes to a file you licensed stay under that licence. The rest of their program, including a proprietary program, can be under other terms.',
          ids: ['mpl']
        },
        {
          id: 'share-lib',
          short: 'Library copyleft',
          label: 'The library. A closed program may link to it, not copy it in',
          detail: 'Someone who modifies the library and ships it must share those modifications. Their application can stay closed if it uses the library as a library.',
          ids: ['lgpl']
        },
        {
          id: 'share-dist',
          short: 'Copyleft on distribution',
          label: 'The whole combined work, when they give someone a copy',
          detail: 'A binary they ship has to come with source, under the same terms. A modification they only run inside their own walls can stay private.',
          ids: ['gpl2', 'gpl3']
        },
        {
          id: 'share-net',
          short: 'Copyleft over the network',
          label: 'The whole combined work, including a modified version people use over a network',
          detail: 'The copyleft for a server. Offering your modified program as a service is not a way around publishing the changes.',
          ids: ['agpl']
        }
      ]
    },
    {
      id: 'gpl',
      ask: 'Which GPL?',
      help: 'Take version 3 unless you have to combine with code that is GPL-2.0 only.',
      options: [
        {
          id: 'gpl-v3',
          short: 'GPL-3.0 or later',
          label: 'Version 3 or later',
          detail: 'Includes a patent grant from contributors, and Apache-2.0 code can be brought in. This is the one to take when nothing forces an older version.',
          ids: ['gpl3']
        },
        {
          id: 'gpl-v2',
          short: 'GPL-2.0 only',
          label: 'Version 2 only',
          detail: 'The form a GPL-2.0-only dependency forces, including a Linux kernel module. There is no patent grant, and Apache-2.0 code cannot come in.',
          ids: ['gpl2']
        }
      ]
    },
    {
      id: 'cond',
      ask: 'What do you want in return?',
      help: 'Closed forks stay allowed. The difference is what travels with the copy, and whether contributors grant patents.',
      options: [
        {
          id: 'cond-notice',
          short: 'Attribution',
          label: 'The copyright notice and the licence text. Nothing else',
          detail: 'The short, familiar one. Closed forks are allowed. There is no patent grant and no rule about your name.',
          ids: ['mit']
        },
        {
          id: 'cond-patent',
          short: 'Patent grant',
          label: 'A copyright notice, and a patent grant from everyone who contributes',
          detail: 'The practical permissive licence when companies will contribute, or when you want the patent terms written down. Your trademarks are not included.',
          ids: ['apache']
        },
        {
          id: 'cond-name',
          short: 'No endorsement',
          label: 'A copyright notice, and they may not use your name to promote their version',
          detail: 'A short permissive licence plus a ban on implying that you endorse the fork. There is no patent grant.',
          ids: ['bsd3']
        },
        {
          id: 'cond-zero',
          short: 'No conditions',
          label: 'Nothing. Not even a copyright notice',
          detail: 'Anyone may do anything with the code, with no attribution. The next question is how that should be written.',
          ids: ['bsd0', 'unlicense', 'cc0']
        }
      ]
    },
    {
      id: 'zero',
      ask: 'How should “no conditions” be written?',
      help: 'These three grant the same practical freedom. They are not the same legal instrument, and only two of them are OSI-approved.',
      options: [
        {
          id: 'zero-lic',
          short: 'Zero-clause licence',
          label: 'As a licence with no conditions',
          detail: 'OSI-approved. You keep the copyright, and the licence is the permission, which still works where a court will not let you abandon copyright.',
          ids: ['bsd0']
        },
        {
          id: 'zero-ded',
          short: 'Public-domain dedication',
          label: 'As a public-domain dedication',
          detail: 'OSI-approved, and it says the work is released to the public domain, with a fallback licence if a court will not recognise the dedication.',
          ids: ['unlicense']
        },
        {
          id: 'zero-waiver',
          short: 'Copyright waiver',
          label: 'As a waiver of copyright',
          detail: 'The instrument data projects expect. It is not OSI-approved, and it explicitly does not grant patents or trademarks.',
          ids: ['cc0']
        }
      ]
    }
  ];

  function optionById(id) {
    var i, j, q;
    for (i = 0; i < QUESTIONS.length; i++) {
      q = QUESTIONS[i];
      for (j = 0; j < q.options.length; j++) {
        if (q.options[j].id === id) return q.options[j];
      }
    }
    return null;
  }

  function liveOptions(question, ids) {
    return question.options.filter(function (opt) {
      return opt.ids.some(function (id) { return ids.indexOf(id) !== -1; });
    });
  }

  function nextQuestion(ids) {
    var i, live;
    for (i = 0; i < QUESTIONS.length; i++) {
      live = liveOptions(QUESTIONS[i], ids);
      if (live.length > 1) return { question: QUESTIONS[i], options: live };
    }
    return null;
  }

  /* Replay a list of option ids. Stops at the first id that is not one of
     the options still on the table, so a bad query cannot walk off the tree. */
  function resolve(answerIds) {
    var ids = ORDER.slice();
    var accepted = [];
    var i, step, opt, id;
    for (i = 0; i < answerIds.length; i++) {
      step = nextQuestion(ids);
      if (!step) break;
      opt = null;
      for (id = 0; id < step.options.length; id++) {
        if (step.options[id].id === answerIds[i]) opt = step.options[id];
      }
      if (!opt) break;
      ids = ids.filter(function (licenceId) { return opt.ids.indexOf(licenceId) !== -1; });
      accepted.push(opt.id);
    }
    return { ids: ids, accepted: accepted, next: nextQuestion(ids) };
  }

  root.licencePick = {
    order: ORDER,
    questions: QUESTIONS,
    optionById: optionById,
    resolve: resolve
  };

  if (typeof document === 'undefined') return;

  var byId = Object.create(null);
  Array.prototype.forEach.call(document.querySelectorAll('.pick-card'), function (card) {
    byId[card.getAttribute('data-id')] = card;
  });

  var countEl = document.getElementById('pick-count');
  var bandsEl = document.getElementById('pick-bands');
  var asideEl = document.getElementById('pick-aside');
  var askedEl = document.getElementById('pick-asked');
  var stageEl = document.getElementById('pick-stage');
  var resultEl = document.getElementById('pick-result');
  var slotEl = document.getElementById('pick-slot');
  var paidEl = document.getElementById('pick-paid');
  var catalogue = document.getElementById('pick-catalogue');
  var copyBtn = document.getElementById('pick-copy');
  var answers = [];
  var forced = null;
  var paid = 'same';
  var preview = null;
  var nav = 'replace';
  var silent = false;
  var moved = false;
  var lastCount = '';

  function $(sel, rootEl) { return (rootEl || document).querySelector(sel); }
  function card(id) { return byId[id] || null; }

  function readUrl() {
    var params;
    try { params = new URLSearchParams(window.location.search); }
    catch (err) { params = new URLSearchParams(); }
    var raw = (params.get('a') || '').split('.').filter(Boolean);
    var played = resolve(raw);
    answers = played.accepted.slice();
    var ids = played.ids;
    var want = params.get('lic');
    forced = want && ids.indexOf(want) !== -1 ? want : null;
    paid = params.get('paid') === 'closed' ? 'closed' : 'same';
    preview = null;
  }

  function state() {
    return { a: answers.slice(), lic: forced, paid: paid };
  }

  function writeUrl() {
    if (silent) return;
    var params = new URLSearchParams();
    if (answers.length) params.set('a', answers.join('.'));
    if (forced) params.set('lic', forced);
    if (paid === 'closed' && resultEl && !resultEl.hidden) params.set('paid', 'closed');
    var search = params.toString();
    var next = window.location.pathname + (search ? '?' + search : '') + window.location.hash;
    var now = window.location.pathname + window.location.search + window.location.hash;
    if (next === now) { nav = 'replace'; return; }
    var method = nav === 'push' ? 'pushState' : 'replaceState';
    nav = 'replace';
    if (window.history && window.history[method]) {
      window.history[method](state(), '', next);
    }
  }

  function setCount(text) {
    if (!countEl || text === lastCount) return;
    lastCount = text;
    countEl.textContent = text;
  }

  function paintCount(ids) {
    var n = ids.length;
    var total = ORDER.length;
    if (n === total) setCount(total + ' licences, from private to public domain.');
    else if (n === 1) setCount('1 of ' + total + ' still fits.');
    else setCount(n + ' of ' + total + ' still fit.');
  }

  function paintRail(ids) {
    bandsEl.textContent = '';
    var group = null;
    var band = null;
    var stops = null;
    ORDER.forEach(function (id) {
      var el = card(id);
      if (!el) return;
      var name = el.getAttribute('data-group') || '';
      if (name !== group) {
        group = name;
        band = document.createElement('div');
        band.className = 'pick-band';
        var title = document.createElement('p');
        title.className = 'pick-band-name';
        title.textContent = name;
        stops = document.createElement('div');
        stops.className = 'pick-band-stops';
        band.appendChild(title);
        band.appendChild(stops);
        bandsEl.appendChild(band);
      }
      var fit = ids.indexOf(id) !== -1;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pick-stop';
      btn.setAttribute('data-fit', fit ? 'in' : 'out');
      btn.setAttribute('data-id', id);
      btn.setAttribute('aria-pressed', preview === id || (forced === id && fit) ? 'true' : 'false');
      if ((forced && forced === id) || (!forced && ids.length === 1 && fit)) {
        btn.setAttribute('aria-current', 'true');
      }
      btn.appendChild(document.createTextNode(el.getAttribute('data-short') || id));
      if (!fit) {
        var note = document.createElement('span');
        note.className = 'sr-only';
        note.textContent = ', ruled out';
        btn.appendChild(note);
      }
      stops.appendChild(btn);
    });
  }

  function why(id) {
    var ids = ORDER.slice();
    var i, opt;
    for (i = 0; i < answers.length; i++) {
      opt = optionById(answers[i]);
      if (opt && opt.ids.indexOf(id) === -1) {
        return 'Ruled out when you chose “' + opt.short + '”.';
      }
      if (opt) ids = ids.filter(function (licenceId) { return opt.ids.indexOf(licenceId) !== -1; });
    }
    return 'Ruled out by the answers so far.';
  }

  function paintAside(ids) {
    asideEl.hidden = true;
    asideEl.textContent = '';
    if (!preview) return;
    var el = card(preview);
    if (!el) return;
    asideEl.hidden = false;
    var name = el.querySelector('.pick-name');
    var label = name ? name.textContent : preview;
    if (ids.indexOf(preview) === -1) {
      asideEl.textContent = label + '. ' + why(preview);
      return;
    }
    if (ids.length === 1 || forced === preview) {
      asideEl.textContent = label + ' is the licence these answers reach.';
      return;
    }
    asideEl.appendChild(document.createTextNode(label + ' still fits. '));
    var use = document.createElement('button');
    use.type = 'button';
    use.className = 'btn btn-ghost btn-sm';
    use.textContent = 'Use this licence';
    use.addEventListener('click', function () {
      forced = preview;
      moved = true;
      nav = 'push';
      render();
    });
    asideEl.appendChild(use);
  }

  function paintAsked() {
    askedEl.textContent = '';
    if (!answers.length) return;
    answers.forEach(function (id, index) {
      var opt = optionById(id);
      if (!opt) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pick-chip';
      btn.textContent = opt.short;
      btn.setAttribute('aria-label', 'Change the answer “' + opt.short + '”, and drop the answers after it');
      btn.addEventListener('click', function () {
        answers = answers.slice(0, index);
        forced = null;
        preview = null;
        moved = true;
        nav = 'push';
        render();
      });
      askedEl.appendChild(btn);
    });
  }

  function parkCards() {
    ORDER.forEach(function (id) {
      var el = card(id);
      if (!el) return;
      el.classList.remove('is-shown');
      if (el.parentNode !== catalogue) catalogue.appendChild(el);
    });
  }

  function showCard(id) {
    parkCards();
    var el = card(id);
    if (!el) return;
    el.classList.add('is-shown');
    slotEl.appendChild(el);
  }

  function focusEl(el) {
    if (!moved || !el) return;
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    try { el.focus({ preventScroll: true }); } catch (err) { /* no-op */ }
  }

  function optionButton(opt) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pick-option';
    var strong = document.createElement('span');
    strong.className = 'pick-option-label';
    strong.textContent = opt.label;
    var detail = document.createElement('span');
    detail.className = 'pick-option-detail';
    detail.textContent = opt.detail;
    btn.appendChild(strong);
    btn.appendChild(detail);
    btn.addEventListener('click', function () {
      answers.push(opt.id);
      forced = null;
      preview = null;
      moved = true;
      nav = 'push';
      render();
    });
    return btn;
  }

  function wireOptionKeys(buttons) {
    buttons.forEach(function (btn, index) {
      btn.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = buttons[(index + 1) % buttons.length];
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = buttons[(index - 1 + buttons.length) % buttons.length];
        else if (e.key === 'Home') next = buttons[0];
        else if (e.key === 'End') next = buttons[buttons.length - 1];
        if (!next) return;
        e.preventDefault();
        next.focus();
      });
    });
  }

  function showQuestion(step) {
    resultEl.hidden = true;
    stageEl.hidden = false;
    parkCards();
    stageEl.textContent = '';
    var field = document.createElement('fieldset');
    field.className = 'pick-fieldset';
    var legend = document.createElement('legend');
    legend.className = 'pick-q';
    legend.id = 'pick-q';
    legend.textContent = step.question.ask;
    var help = document.createElement('p');
    help.className = 'pick-help';
    help.textContent = step.question.help;
    var list = document.createElement('div');
    list.className = 'pick-options';
    var buttons = step.options.map(optionButton);
    buttons.forEach(function (btn) { list.appendChild(btn); });
    wireOptionKeys(buttons);
    field.appendChild(legend);
    field.appendChild(help);
    field.appendChild(list);
    stageEl.appendChild(field);
    focusEl(legend);
  }

  function showShortlist(ids) {
    resultEl.hidden = true;
    stageEl.hidden = false;
    parkCards();
    stageEl.textContent = '';
    var field = document.createElement('fieldset');
    field.className = 'pick-fieldset';
    var legend = document.createElement('legend');
    legend.className = 'pick-q';
    legend.textContent = 'More than one licence still fits';
    var help = document.createElement('p');
    help.className = 'pick-help';
    help.textContent = 'No further question splits them. Take the one whose conditions you actually want.';
    var list = document.createElement('div');
    list.className = 'pick-options';
    var buttons = ids.map(function (id) {
      var el = card(id);
      var summary = el ? el.querySelector('.pick-summary') : null;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pick-option';
      var strong = document.createElement('span');
      strong.className = 'pick-option-label';
      strong.textContent = el && el.querySelector('.pick-name') ? el.querySelector('.pick-name').textContent : id;
      var detail = document.createElement('span');
      detail.className = 'pick-option-detail';
      detail.textContent = summary ? summary.textContent : '';
      btn.appendChild(strong);
      btn.appendChild(detail);
      btn.addEventListener('click', function () {
        forced = id;
        preview = null;
        moved = true;
        nav = 'push';
        render();
      });
      return btn;
    });
    buttons.forEach(function (btn) { list.appendChild(btn); });
    wireOptionKeys(buttons);
    field.appendChild(legend);
    field.appendChild(help);
    field.appendChild(list);
    stageEl.appendChild(field);
    focusEl(legend);
  }

  function syncPaid(el) {
    var open = el && el.getAttribute('data-paid') === 'yes';
    paidEl.hidden = !open;
    Array.prototype.forEach.call(paidEl.querySelectorAll('[data-paid-value]'), function (btn) {
      var on = btn.getAttribute('data-paid-value') === paid;
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
      btn.tabIndex = on ? 0 : -1;
    });
    Array.prototype.forEach.call(paidEl.querySelectorAll('[data-note]'), function (note) {
      note.hidden = note.getAttribute('data-note') !== paid;
    });
  }

  function showResult(id) {
    stageEl.hidden = true;
    stageEl.textContent = '';
    resultEl.hidden = false;
    showCard(id);
    syncPaid(card(id));
    var name = card(id) && card(id).querySelector('.pick-name');
    focusEl(name);
  }

  function render() {
    var played = resolve(answers);
    answers = played.accepted.slice();
    var ids = played.ids;
    if (forced && ids.indexOf(forced) === -1) forced = null;
    paintCount(ids);
    paintRail(ids);
    paintAside(ids);
    paintAsked();
    if (forced) showResult(forced);
    else if (!played.next && ids.length === 1) showResult(ids[0]);
    else if (!played.next) showShortlist(ids);
    else showQuestion(played.next);
    writeUrl();
    moved = false;
  }

  bandsEl.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.pick-stop') : null;
    if (!btn || !bandsEl.contains(btn)) return;
    preview = btn.getAttribute('data-id');
    render();
  });

  function choosePaid(value, focus) {
    paid = value === 'closed' ? 'closed' : 'same';
    syncPaid(slotEl.querySelector('.pick-card'));
    if (focus) focus.focus();
    writeUrl();
  }

  paidEl.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-paid-value]') : null;
    if (!btn || paidEl.hidden) return;
    choosePaid(btn.getAttribute('data-paid-value'), null);
  });

  paidEl.addEventListener('keydown', function (e) {
    if (paidEl.hidden) return;
    var opts = Array.prototype.slice.call(paidEl.querySelectorAll('[data-paid-value]'));
    var i = opts.indexOf(document.activeElement);
    var dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    var next = null;
    if (dir && i > -1) next = opts[(i + dir + opts.length) % opts.length];
    else if (e.key === 'Home') next = opts[0];
    else if (e.key === 'End') next = opts[opts.length - 1];
    if (!next) return;
    e.preventDefault();
    choosePaid(next.getAttribute('data-paid-value'), next);
  });

  document.getElementById('pick-reset').addEventListener('click', function () {
    answers = [];
    forced = null;
    paid = 'same';
    preview = null;
    moved = true;
    nav = 'push';
    render();
    var q = document.getElementById('pick-q');
    focusEl(q);
  });

  function flash(btn, done) {
    var previous = btn.textContent;
    btn.textContent = done;
    window.setTimeout(function () { btn.textContent = previous; }, 1600);
  }

  function copyText(text, btn, done) {
    function ok() { flash(btn, done); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, function () { fallback(); });
      return;
    }
    fallback();
    function fallback() {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.left = '-999px';
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy'); ok(); } catch (err) { /* leave the label */ }
      document.body.removeChild(area);
    }
  }

  copyBtn.addEventListener('click', function () {
    copyText(window.location.href, copyBtn, 'Copied');
  });

  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.pick-copy-id') : null;
    if (!btn) return;
    copyText(btn.getAttribute('data-spdx') || '', btn, 'Copied');
  });

  Array.prototype.forEach.call(document.querySelectorAll('.pick-card'), function (el) {
    var spdx = el.getAttribute('data-spdx');
    var line = el.querySelector('.pick-id');
    if (!spdx || !line) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-ghost btn-sm pick-copy-id';
    btn.setAttribute('data-spdx', spdx);
    btn.textContent = 'Copy identifier';
    line.appendChild(btn);
  });

  window.addEventListener('popstate', function () {
    silent = true;
    readUrl();
    render();
    silent = false;
  });

  readUrl();
  render();
})(typeof globalThis !== 'undefined' ? globalThis : this);
