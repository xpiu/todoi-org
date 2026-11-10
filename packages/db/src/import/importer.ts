import { parse, type HTMLElement } from 'node-html-parser';
import { bandOf, csvObjects, type DirectoryCopy, type FilterToggle, type Level } from '@todoi/shared';
import { SeedDirectory, type SeedRecord } from '../seed-schema.ts';
import { APP_DEFAULTS } from './defaults.ts';

/**
 * Reads what is published - the two pages and the two CSVs - because they
 * carry hand edits the old build scripts do not. Every value is taken from
 * the page; the CSV supplies only what the page never shows (Price_Note) and
 * is otherwise used to check the page against itself.
 */

type Kind = 'oss' | 'commercial';

interface PageConfig {
  noun?: [string, string];
  toggles?: string[];
  toggleNames?: Record<string, string>;
  toggleToken?: string;
  chipToken?: string;
  keys?: Record<string, number>;
  ascKeys?: Record<string, number>;
  dirWords?: Record<string, [string, string]>;
  filterSummary?: string;
  filterNoun?: string;
  empty?: {
    search?: string;
    filtersTitle?: string;
    dynamic?: boolean;
    inline?: Record<string, string>;
    audience?: Record<string, string>;
    filters?: string;
  };
  crit?: Record<string, { head: string; title: string; sr: string }>;
  critTail?: string;
  lic?: Record<string, string>;
  comm?: Record<string, string>;
  commTail?: string;
}

export class ImportError extends Error {}

function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new ImportError(`missing: ${what}`);
  return value;
}

function one(root: HTMLElement, sel: string, what = sel): HTMLElement {
  return must(root.querySelector(sel), what);
}

/** Decoded text, whitespace as authored but trimmed. */
function text(el: HTMLElement | null | undefined): string {
  return el ? el.text.trim() : '';
}

/** Collapse the source's line breaks inside running copy. */
function prose(el: HTMLElement | null | undefined): string {
  return text(el).replace(/\s+/g, ' ');
}

/** Inner HTML for editorial copy, with the source's indentation folded. */
function html(el: HTMLElement): string {
  return el.innerHTML.trim().replace(/\s*\n\s*/g, ' ');
}

function attr(el: HTMLElement, name: string): string {
  return must(el.getAttribute(name), `${el.rawTagName}[${name}]`);
}

/** getAttribute decodes entities, so a title reads as the browser shows it. */
function title(el: HTMLElement): string {
  return attr(el, 'title');
}

function iconOf(svg: HTMLElement | null, table: Record<string, string>): string {
  if (!svg) throw new ImportError('icon svg missing');
  const norm = (s: string) => parse(s).toString().replace(/\s+/g, ' ').trim();
  const sig = norm(svg.innerHTML);
  for (const [name, inner] of Object.entries(table)) if (norm(inner) === sig) return name;
  throw new ImportError(`unknown icon: ${sig.slice(0, 80)}`);
}

/** The SVG bodies the pages use, keyed by the names the React icon set exports. */
export const ICON_BODIES: Record<string, string> = {
  time: '<path d="M6.2 1.6h3.6M8 1.6v1.9"/><circle cx="8" cy="9.3" r="5.2"/><path d="M8 6.6v2.7h2.2"/>',
  boards:
    '<rect x="1.9" y="2.9" width="3.3" height="10.2" rx="1.1" fill="currentColor" stroke="none"/><rect x="6.35" y="2.9" width="3.3" height="6.4" rx="1.1" fill="currentColor" stroke="none"/><rect x="10.8" y="2.9" width="3.3" height="8.3" rx="1.1" fill="currentColor" stroke="none"/>',
  gantt: '<path d="M2.1 3v10"/><path d="M4.5 4.9h5.8M6.7 8h6.5M5.3 11.1h4.4" stroke-width="1.8"/>',
  calendar:
    '<rect x="1.9" y="3.2" width="12.2" height="10.9" rx="1.4"/><path d="M1.9 6.6h12.2M5.3 1.8v2.8M10.7 1.8v2.8"/><circle cx="5.6" cy="10.2" r="1" fill="currentColor" stroke="none"/>',
  sync: '<path d="M14.8 3v3.7h-3.7M1.2 13V9.3h3.7"/><path d="M2.75 6.15a5.58 5.58 0 0 1 9.2-2.09l2.85 2.66M1.2 9.3l2.85 2.66a5.58 5.58 0 0 0 9.2-2.09"/>',
  free: '<path d="M8.7 1.9h4.6a.8.8 0 0 1 .8.8v4.6L7.7 13.7a1 1 0 0 1-1.4 0L2.3 9.7a1 1 0 0 1 0-1.4z"/><circle cx="11.1" cy="4.9" r="1" fill="currentColor" stroke="none"/>',
  foss: '<path d="M5.5 7.9V5.2a2.5 2.5 0 0 1 5 0"/><rect x="2.9" y="7.7" width="10.2" height="6.1" rx="1.4" fill="currentColor"/>',
  'open-core':
    '<path d="M5.5 7.9V5.2a2.5 2.5 0 0 1 5 0"/><rect x="2.9" y="7.7" width="10.2" height="6.1" rx="1.4"/><path d="M8 8.5H4.6a.7.7 0 0 0-.7.7v2.7a.7.7 0 0 0 .7.7H8z" fill="currentColor" stroke="none"/>',
  'source-available': '<path d="M5.5 7.9V5.9a2.5 2.5 0 0 1 5 0v2"/><rect x="2.9" y="7.7" width="10.2" height="6.1" rx="1.4"/>',
  personal: '<circle cx="8" cy="5.2" r="2.6"/><path d="M3 14.2a5 5 0 0 1 10 0"/>',
  team: '<circle cx="5.6" cy="5.6" r="2.2"/><circle cx="11" cy="6.4" r="1.8"/><path d="M1.6 13.8a4 4 0 0 1 8 0M10.2 10.1a3.4 3.4 0 0 1 4.4 3.3"/>',
  software: '<path d="M5.4 4.4 1.8 8l3.6 3.6M10.6 4.4 14.2 8l-3.6 3.6M9.1 2.9 6.9 13.1"/>',
  enterprise:
    '<rect x="2.6" y="2" width="7" height="12.2" rx="0.8"/><path d="M9.6 6.4h3a.8.8 0 0 1 .8.8v7M1.4 14.2h13.2M4.8 4.8h2.6M4.8 7.6h2.6M4.8 10.4h2.6"/>',
};

const LEVEL_WORD: Record<string, Level> = { 'Not native': 0, Partial: 1, Native: 2 };
const CSV_LEVEL: Record<Level, string> = { 0: 'NO', 1: 'PARTIAL', 2: 'NATIVE' };

export interface ImportInput {
  kind: Kind;
  slug: string;
  path: string;
  html: string;
  csv: string;
  csvFile: string;
  modifiedOn: string;
}

export function importDirectory(input: ImportInput): SeedDirectory {
  const { kind } = input;
  const doc = parse(input.html, { comment: false });
  const cfgEl = doc.querySelector('#directory-config');
  const cfg: PageConfig = cfgEl ? (JSON.parse(cfgEl.text) as PageConfig) : {};
  const csvRows = csvObjects(input.csv);
  const csvByName = new Map(csvRows.map((r) => [r.Name!, r]));

  const meta = (sel: string) => attr(one(doc, sel), 'content');

  /* ---- criteria: the sort select's "Criteria" group, in order ---- */
  const sortGroups = doc.querySelectorAll('#sort-field optgroup').map((g) => ({
    label: attr(g, 'label'),
    options: g.querySelectorAll('option').map((o) => ({ value: attr(o, 'value'), label: text(o) })),
  }));
  const critGroup = must(
    sortGroups.find((g) => g.label === 'Criteria'),
    'Criteria optgroup',
  );
  const critDefs = { ...APP_DEFAULTS.crit, ...(cfg.crit ?? {}) };
  const methodTexts = doc
    .querySelectorAll('.criteria .criterion:not(.criterion-band)')
    .map((c) => ({ name: text(c.querySelector('.criterion-name')), text: prose(c.querySelector('.criterion-text')) }));
  const csvHead = Object.keys(csvRows[0] ?? {});
  const csvScoreCols = csvHead.filter((h) => h.endsWith('_Score_1_5')).map((h) => h.replace(/_Score_1_5$/, ''));
  const criteria = critGroup.options.map((o, i) => {
    const def = must(critDefs[o.value], `criterion ${o.value}`);
    const method = must(
      methodTexts.find((m) => m.name === o.label),
      `method text for ${o.label}`,
    );
    return {
      key: o.value,
      name: o.label,
      head: def.head,
      sr: def.sr,
      tip: def.title,
      text: method.text,
      csv: must(csvScoreCols[i], `CSV score column ${i}`),
    };
  });

  /* ---- capabilities: read from the first record's detail ---- */
  const firstDetail = one(doc, 'tr.detail-row');
  const capLabels = firstDetail.querySelectorAll('.cap .cap-l > .methodology');
  const capSr = firstDetail.querySelectorAll('.cap > .sr-only').map((s) => text(s).split(': ')[0]!);
  const capKeys = (cfg.toggles ?? ['tt', 'agile', 'gantt', 'calendar', 'caldav']).filter((k) => k !== 'free');
  const capCsvCols =
    kind === 'oss'
      ? ['Time_Tracking', 'Agile_Views', 'Gantt_View', 'Calendar_View', 'Open_Calendar_Sync']
      : ['Time_tracking', 'Kanban_or_Scrum_boards', 'Gantt_or_dependency_timeline', 'Calendar_view', 'Two-way_calendar_sync'];
  const capabilities = capKeys.map((key, i) => {
    const label = must(capLabels[i], `cap label ${key}`);
    return { key, label: text(label), tip: title(label), sr: must(capSr[i], `cap sr ${key}`), csv: capCsvCols[i]! };
  });

  /* ---- filter toggles ---- */
  const toggleNames = { ...APP_DEFAULTS.toggleNames, ...(cfg.toggleNames ?? {}) };
  const toggles: FilterToggle[] = (cfg.toggles ?? capKeys).map((key) => {
    const input = one(doc, `#f-${key}`);
    const label = must(input.closest('label'), `toggle label ${key}`);
    return {
      key,
      label: text(label.querySelector('.toggle-label')),
      title: label.getAttribute('title') ? title(label) : null,
      token: must(toggleNames[key], `toggle name ${key}`),
      inline: cfg.empty?.inline?.[key] ?? null,
      icon: iconOf(label.querySelector('svg.toggle-icon'), ICON_BODIES),
    };
  });

  /* ---- segments: chips, tags in the matrix, definitions in the method ---- */
  const lic = { ...(kind === 'oss' ? APP_DEFAULTS.lic : {}), ...(cfg.lic ?? {}) };
  const chips = doc.querySelectorAll('#model-chips button.chip');
  const defs = doc.querySelectorAll('.model-defs .model-def');
  const segKeys: string[] = [];
  const segInfo = new Map<string, { label: string; tagClass: string; icon: string }>();
  for (const tag of doc.querySelectorAll('td.cell-model .tag')) {
    const key = attr(tag, 'data-lic');
    if (!segInfo.has(key)) {
      segKeys.push(key);
      segInfo.set(key, {
        label: text(tag),
        tagClass: attr(tag, 'class').replace(/^tag tag-/, ''),
        icon: iconOf(tag.querySelector('svg'), ICON_BODIES),
      });
    }
  }
  const chipOrder = chips.map((c) => attr(c, 'data-model'));
  // Chip order first, then any tag-only segment (FOSS app) after its parent.
  const orderedKeys = [...chipOrder, ...segKeys.filter((k) => !chipOrder.includes(k))];
  const csvModelCol = kind === 'oss' ? 'Open_Source_Model' : 'Built_For';
  const segments = orderedKeys.map((key) => {
    const info = must(segInfo.get(key), `segment ${key} in matrix`);
    const chip = chips.find((c) => attr(c, 'data-model') === key) ?? null;
    const def = defs.find((d) => text(d.querySelector('.model-name')) === info.label) ?? null;
    // Records tagged with this segment: their data-model is the chip they answer to.
    const tagged = doc
      .querySelectorAll('tr.matrix-row')
      .filter((r) => r.querySelector('td.cell-model .tag')?.getAttribute('data-lic') === key);
    const filter = attr(must(tagged[0], `a record tagged ${key}`), 'data-model');
    const csvLabels = new Set(tagged.map((r) => csvByName.get(text(r.querySelector('.project-name')))?.[csvModelCol]));
    if (csvLabels.size !== 1) throw new ImportError(`segment ${key}: CSV labels ${[...csvLabels].join(', ')}`);
    return {
      key,
      label: info.label,
      chip: chip ? text(chip) : null,
      chipAria: chip?.getAttribute('aria-label') ?? null,
      filter,
      tagClass: info.tagClass,
      icon: info.icon,
      tip: must(lic[key], `licence tooltip ${key}`),
      definition: def ? prose(def.querySelector('.model-text')) : null,
      audience: cfg.empty?.audience?.[key] ?? null,
      csvLabel: [...csvLabels][0]!,
    };
  });

  /* ---- page copy ---- */
  const th = doc.querySelectorAll('table.matrix thead th');
  const head = (i: number) => {
    const m = one(must(th[i], `th ${i}`), '.methodology');
    return { label: text(m), tip: title(m) };
  };
  const methodNotes = doc
    .querySelectorAll('.method-inner > .method-note')
    .map((p) => html(p) as DirectoryCopy['matrix']['updated']);
  const contribTexts = doc.querySelectorAll('.contribute-col .contribute-text');
  const mailto = attr(one(doc, '.contribute-actions a.btn-primary'), 'href');
  const crosslink = one(doc, 'a.crosslink-link');
  const footerLinks = doc.querySelectorAll('.footer-nav a');
  const otherLink = must(footerLinks[footerLinks.length - 1], 'footer link');
  const scoreSr = text(one(doc, '[data-score-sr]')).replace(/: [\d.]+ out of 5$/, '');
  const comm = { ...(kind === 'oss' ? APP_DEFAULTS.comm : {}), ...(cfg.comm ?? {}) };
  const cardFacts = one(doc, 'article.card').querySelectorAll('.card-meta dt').map(text);

  const copy: DirectoryCopy = {
    head: {
      title: text(one(doc, 'title')),
      description: meta('meta[name="description"]'),
      ogTitle: meta('meta[property="og:title"]'),
      ogImage: meta('meta[property="og:image"]'),
      ogImageAlt: meta('meta[property="og:image:alt"]'),
      csvTitle: attr(one(doc, 'link[rel="alternate"][type="text/csv"]'), 'title'),
    },
    hero: {
      title: text(one(doc, '.hero-title')),
      lede: prose(one(doc, '.hero-lede')),
      mark: doc.querySelector('.hero-mark') !== null,
    },
    controls: {
      searchPlaceholder: attr(one(doc, '#q'), 'placeholder'),
      sortGroups,
      togglesLegend: text(one(doc, '#filter-options legend')),
      chipsLabel: text(one(doc, '#model-chips-label')),
      filterSummary: cfg.filterSummary ?? text(one(doc, '#filter-disclosure-summary')),
      filterNoun: cfg.filterNoun ?? APP_DEFAULTS.filterNoun,
      toggleToken: cfg.toggleToken ?? APP_DEFAULTS.toggleToken,
      chipToken: cfg.chipToken ?? APP_DEFAULTS.chipToken,
    },
    matrix: {
      caption: prose(one(doc, 'table.matrix caption')),
      project: head(0),
      model: head(1),
      community: head(3),
      metric: head(4),
      integrations: head(5),
      year: head(6),
      capsTip: title(one(firstDetail, '.detail-caps .detail-h .methodology')),
      eagerIcons: doc.querySelectorAll('tr.matrix-row img.project-icon:not([loading])').length,
      updated: html(one(doc, '.matrix-updated')) as DirectoryCopy['matrix']['updated'],
      provenance: html(one(doc, '.matrix-foot .provenance')) as DirectoryCopy['matrix']['provenance'],
    },
    cards: {
      blurb: doc.querySelector('article.card .card-blurb') !== null,
      eagerIcons: doc.querySelectorAll('article.card img.project-icon:not([loading])').length,
      modelLabel: must(cardFacts[0], 'card model label'),
      communityLabel: must(cardFacts[1], 'card community label'),
      metricLabel: must(cardFacts[2], 'card metric label'),
    },
    facts: { yearLabel: text(one(firstDetail, '.facts .fact dt')) },
    score: {
      tip: must(critDefs.avg, 'avg').title,
      sr: scoreSr,
      critTail: cfg.critTail ?? APP_DEFAULTS.critTail,
    },
    band: {
      name: text(one(doc, '.criterion-band .criterion-name')),
      text: prose(one(doc, '.criterion-band .criterion-text')),
      tips: comm,
      tail: cfg.commTail ?? APP_DEFAULTS.commTail,
    },
    empty: {
      search: cfg.empty?.search ?? APP_DEFAULTS.empty.search,
      filtersTitle: cfg.empty?.filtersTitle ?? APP_DEFAULTS.empty.filtersTitle,
      filters: cfg.empty?.filters ?? APP_DEFAULTS.empty.filters,
      dynamic: cfg.empty?.dynamic ?? false,
    },
    dirWords: cfg.dirWords ?? {},
    ascKeys: Object.keys(cfg.ascKeys ?? {}),
    routes: { title: text(one(doc, '#start-title')), note: prose(one(doc, '.routes .section-note')) },
    method: {
      title: text(one(doc, '#method-title')),
      note: prose(one(doc, '.method .section-note')),
      notes: methodNotes,
      modelsTitle: text(one(doc, '#models-title')),
      modelsNote: html(one(doc, '.models .method-note')) as DirectoryCopy['method']['modelsNote'],
    },
    contribute: {
      text: prose(must(contribTexts[0], 'contribute text')),
      listingTitle: text(one(doc, '.contribute-col .sub-title')),
      listing: html(must(contribTexts[1], 'listing text')) as DirectoryCopy['contribute']['listing'],
      mailSubject: decodeURIComponent(mailto.replace(/^mailto:[^?]+\?subject=/, '')),
    },
    crosslink: {
      href: attr(crosslink, 'href'),
      title: text(one(crosslink, '.crosslink-title')),
      text: prose(one(crosslink, '.crosslink-text')),
    },
    footer: { note: prose(one(doc, '.footer-note')), otherLabel: text(otherLink), otherHref: attr(otherLink, 'href') },
  };

  /* ---- editorial lists ---- */
  const faqs = doc
    .querySelectorAll('details.acc')
    .map((d) => ({ question: text(one(d, '.acc-q')), answer: html(one(d, '.acc-a')) }));
  const routes = doc
    .querySelectorAll('.route-list .route')
    .map((r) => ({ case: prose(one(r, '.route-case')), pick: html(one(r, '.route-pick')) }));
  const revisions = doc
    .querySelectorAll('.revisions > div')
    .map((r) => ({ date: attr(one(r, 'dt time'), 'datetime'), text: html(one(r, 'dd')) }));

  /* ---- records ---- */
  const cards = new Map(doc.querySelectorAll('article.card').map((c) => [attr(c, 'data-slug'), c]));
  const records: SeedRecord[] = doc.querySelectorAll('tr.matrix-row').map((row) => {
    const slug = attr(row, 'data-slug');
    const data = (k: string) => row.getAttribute(`data-${k}`) ?? '';
    const detail = one(doc, `#detail-${slug}`);
    const nameEl = one(row, '.project-name');
    const name = text(nameEl);
    const csv = must(csvByName.get(name), `CSV row for ${name}`);
    const facts = new Map(
      detail.querySelectorAll('.facts .fact').map((f) => [text(f.querySelector('dt')), one(f, 'dd')] as const),
    );
    const fact = (label: string) => prose(must(facts.get(label), `${slug}: fact ${label}`));

    const crits = detail.querySelectorAll('.crits .crit');
    const scores: SeedRecord['scores'] = {};
    criteria.forEach((c, i) => {
      const el = must(crits[i], `${slug}: crit ${c.key}`);
      if (text(el.querySelector('.crit-name')).replace(/[\d.]+$/, '').trim() !== c.name) {
        throw new ImportError(`${slug}: criterion ${i} is not ${c.name}`);
      }
      scores[c.key] = { score: Number(text(el.querySelector('.crit-score'))), review: prose(el.querySelector('.crit-text')) };
    });
    const bandCrit = must(crits[criteria.length], `${slug}: band crit`);

    const capEls = detail.querySelectorAll('.caps .cap');
    const caps: SeedRecord['caps'] = {};
    capabilities.forEach((c, i) => {
      const el = must(capEls[i], `${slug}: cap ${c.key}`);
      const level = Number(data(c.key)) as Level;
      const sr = text(el.querySelector('.sr-only'));
      const word = sr.slice(c.sr.length + 2).split('.')[0]!;
      if (LEVEL_WORD[word] !== level) throw new ImportError(`${slug}: cap ${c.key} sr "${word}" vs data ${level}`);
      const note = el.querySelector('.cap-note');
      caps[c.key] = { level, note: note ? prose(note) : null };
    });

    const summaryEl = one(detail, '.summary');
    const base: SeedRecord = {
      slug,
      name,
      url: attr(nameEl, 'href'),
      icon: attr(one(row, 'img.project-icon'), 'src').replace(/^(?!\/)/, '/'),
      blurb: prose(one(row, '.project-blurb')),
      model: attr(one(row, 'td.cell-model .tag'), 'data-lic'),
      modelSub: prose(one(row, 'td.cell-model .cell-sub')),
      summary: summaryEl.querySelectorAll('p').map(prose),
      summaryDate: attr(one(detail, '.summary-date time'), 'datetime'),
      year: Number(data('year')),
      band: Number(data('community')),
      bandEvidence: fact(kind === 'oss' ? 'Community signal' : 'Market signal'),
      integrationsLabel: text(one(row, 'td.cell-int .num')),
      integrations: Number(data('integrations')),
      integrationNotes: fact('Integrations'),
      calendarSync: fact('Calendar sync'),
      dataOut: fact('Data out'),
      caveat: fact('Caveat'),
      confidence: fact('Confidence') as SeedRecord['confidence'],
      scores,
      caps,
      sources: detail.querySelectorAll('.srcs a').map((a) => ({ url: attr(a, 'href'), label: text(a) })),
    };

    // The band's own line in the assessment: "Very large. <evidence>".
    const bandLine = prose(bandCrit.querySelector('.crit-text'));
    if (bandLine !== `${text(row.querySelector('.comm-band'))}. ${base.bandEvidence}`) {
      throw new ImportError(`${slug}: band line "${bandLine.slice(0, 60)}"`);
    }
    if (bandOf(text(row.querySelector('.comm-band'))) !== base.band) throw new ImportError(`${slug}: band label`);

    if (kind === 'oss') {
      const repo = one(must(facts.get('Repository'), `${slug}: Repository`), 'a');
      const starsNote = row.querySelector('.cell-stars .stars-note');
      base.oss = {
        licence: fact('Licence'),
        modelNote: fact('Model'),
        repository: text(repo),
        repositoryUrl: attr(repo, 'href'),
        stars: Number(data('stars')),
        starsNote: starsNote ? title(starsNote) : null,
        deployment: fact('Deployment'),
        stack: fact('Stack'),
        hostedOption: fact('Hosted option'),
        capabilityNotes: facts.has('Capability notes') ? facts.get('Capability notes')!.innerHTML.trim() : null,
      };
    } else {
      const priceCell = one(row, 'td.cell-price');
      const dagger = priceCell.querySelector('.stars-note');
      const pub = priceCell.querySelector('.cell-sub-pub');
      const yearFact = fact('First launched');
      base.commercial = {
        vendor: fact('Vendor'),
        yearNote: yearFact === String(base.year) ? null : yearFact,
        price: data('price') === '' ? null : Number(data('price')),
        priceLabel: text(one(priceCell, '.num')),
        listPrice: csv.Price_USD_Per_User_Month_Billed_Annually ? Number(csv.Price_USD_Per_User_Month_Billed_Annually) : null,
        listPriceLabel: must(csv.Price_Label, `${slug}: Price_Label`),
        priceNote: must(csv.Price_Note, `${slug}: Price_Note`),
        priceDagger: dagger ? title(dagger) : null,
        pricePublished: pub ? text(pub) : null,
        freePlan: data('free') === '2',
        freePlanNote: fact('Free plan'),
        plans: fact('Plans'),
        hosting: fact('Hosting'),
        security: fact('Security'),
        platforms: fact('Platforms'),
        ai: fact('AI'),
      };
    }

    const com = base.commercial;
    if (com && !com.priceLabel.startsWith('≈') && com.price !== com.listPrice && com.pricePublished === null) {
      throw new ImportError(`${slug}: page price ${com.price} vs dataset ${com.listPrice}`);
    }
    if (!cards.has(slug)) throw new ImportError(`${slug}: no card`);
    return base;
  });

  const nouns = cfg.noun ?? (['project', 'projects'] as [string, string]);
  const updatedTime = one(doc, '.matrix-updated time');

  const seed = SeedDirectory.parse({
    slug: input.slug,
    kind,
    path: input.path,
    nouns,
    compiledOn: attr(updatedTime, 'datetime'),
    modifiedOn: input.modifiedOn,
    csvFile: input.csvFile,
    toggles,
    copy,
    criteria,
    capabilities,
    segments,
    faqs,
    routes,
    revisions,
    records,
  });
  return seed;
}

export { CSV_LEVEL };
