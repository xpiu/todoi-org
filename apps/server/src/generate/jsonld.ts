import type { FullDirectory, FullRecord } from '@todoi/db';
import { bandLabel, computeScore } from '@todoi/shared';
import { htmlToText } from '../html.ts';
import { defaultOrder } from './csv.ts';

/**
 * The page's JSON-LD graph, built from the database with the @ids the static
 * pages published (https://todoi.org/#huly, …/commercial-task-managers/#asana),
 * so links into the graph and the #slug anchors keep resolving. The two
 * directories were published with different shapes; each keeps its own.
 */
type Node = Record<string, unknown>;
const ref = (id: string) => ({ '@id': id });
const prop = (name: string, value: unknown, range = false): Node =>
  range ? { '@type': 'PropertyValue', name, value, minValue: 1, maxValue: 5 } : { '@type': 'PropertyValue', name, value };

/** One decimal, as a JSON number: 3 is written 3.0 by the serialiser below. */
const ONE_DECIMAL = Symbol('one-decimal');
const dec = (n: number) => ({ [ONE_DECIMAL]: n });

function bare(label: string): string {
  return label.replace(/(\d),(?=\d{3}\b)/g, '$1');
}

function scoreOf(dir: FullDirectory, r: FullRecord): number {
  return computeScore(
    dir.config.criteria.map((c) => r.scores[c.key]!.score),
    r.band,
  );
}

/** The open-source directory names its capabilities in the graph in its own words. */
const OSS_FEATURES: Record<string, string> = {
  tt: 'Time tracking',
  agile: 'Agile boards',
  gantt: 'Gantt or dependency timeline',
  calendar: 'Calendar view',
  caldav: 'Open calendar sync (CalDAV)',
};

function ossGraph(dir: FullDirectory, site: string): Node[] {
  const { config } = dir;
  const { copy } = config;
  const base = `${site}${config.path}`;
  const id = (frag: string) => `${base}#${frag}`;
  const org = `${site}/#org`;
  const records = defaultOrder(dir);
  const ld = copy.ld;

  const apps = records.map((r): Node => {
    const o = r.oss!;
    const native = config.capabilities.filter((c) => r.caps[c.key]?.level === 2).map((c) => OSS_FEATURES[c.key] ?? c.sr);
    const partial = config.capabilities.filter((c) => r.caps[c.key]?.level === 1).map((c) => OSS_FEATURES[c.key] ?? c.sr);
    return {
      '@type': 'SoftwareApplication',
      '@id': id(r.slug),
      name: r.name,
      url: r.url,
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'Project and task management',
      operatingSystem: 'Browser interface; see deployment requirements in the project record',
      description: r.blurb,
      license: o.licence,
      sameAs: [o.repositoryUrl],
      featureList: native,
      additionalProperty: [
        ...config.criteria.map((c) => prop(c.name, dec(r.scores[c.key]!.score), true)),
        prop('Licensing model', o.modelNote),
        prop('Community size proxy', bandLabel(r.band)),
        prop('Estimated external integrations', r.integrationsLabel),
        prop('Deployment', o.deployment),
        prop('Calendar sync', r.calendarSync),
        prop('Data out', r.dataOut),
        prop('Stack', o.stack),
        prop('Hosted option', o.hostedOption),
        ...(partial.length ? [prop('Partial rather than native', partial.join(', '))] : []),
      ],
      review: {
        '@type': 'Review',
        author: ref(org),
        datePublished: config.compiledOn,
        reviewRating: { '@type': 'Rating', ratingValue: dec(scoreOf(dir, r)), bestRating: 5, worstRating: 1 },
        reviewBody: r.caveat,
        reviewAspect: [...config.criteria.map((c) => c.name), copy.band.name]
          .map((n, i) => (i ? n.toLowerCase() : n))
          .join(', '),
      },
    };
  });

  return [
    {
      '@type': 'Organization',
      '@id': org,
      name: 'todoi.org',
      url: `${site}/`,
      ...(ld.org.description ? { description: ld.org.description } : {}),
      ...(ld.org.foundingDate ? { foundingDate: ld.org.foundingDate } : {}),
      email: 'info@todoi.org',
      contactPoint: {
        '@type': 'ContactPoint',
        email: 'info@todoi.org',
        contactType: 'Corrections and additions',
        availableLanguage: 'en',
      },
      ...(ld.org.knowsAbout ? { knowsAbout: ld.org.knowsAbout } : {}),
    },
    {
      '@type': 'WebSite',
      '@id': `${site}/#website`,
      name: 'todoi.org',
      url: `${site}/`,
      publisher: ref(org),
      inLanguage: 'en',
      ...(ld.websiteDescription ? { description: ld.websiteDescription } : {}),
    },
    {
      '@type': 'WebPage',
      '@id': id('webpage'),
      url: base,
      name: copy.head.title,
      description: copy.head.description,
      isPartOf: ref(`${site}/#website`),
      about: ref(id('dataset')),
      mainEntity: ref(id('projects')),
      inLanguage: 'en',
      datePublished: config.compiledOn,
      dateModified: config.modifiedOn,
      lastReviewed: config.modifiedOn,
      reviewedBy: ref(org),
      significantLink: records.map((r) => r.url),
      hasPart: [ref(id('faq'))],
      breadcrumb: ref(id('breadcrumb')),
    },
    {
      '@type': 'BreadcrumbList',
      '@id': id('breadcrumb'),
      itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Directory', item: `${site}/` }],
    },
    {
      '@type': 'FAQPage',
      '@id': id('faq'),
      name: 'Questions',
      isPartOf: ref(id('webpage')),
      inLanguage: 'en',
      mainEntity: config.faqs.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: htmlToText(f.answer) },
      })),
    },
    {
      '@type': 'Dataset',
      '@id': id('dataset'),
      name: ld.dataset.name,
      url: base,
      description: ld.dataset.description,
      creator: ref(org),
      publisher: ref(org),
      dateCreated: config.compiledOn,
      datePublished: config.compiledOn,
      dateModified: config.modifiedOn,
      isAccessibleForFree: true,
      inLanguage: 'en',
      temporalCoverage: config.compiledOn,
      ...(ld.dataset.measurementTechnique ? { measurementTechnique: ld.dataset.measurementTechnique } : {}),
      ...(ld.dataset.keywords ? { keywords: ld.dataset.keywords } : {}),
      variableMeasured: [
        ...config.criteria.map((c) => ({ '@type': 'PropertyValue', name: c.name, description: c.text, minValue: 1, maxValue: 5 })),
        ...(ld.dataset.variables ?? []),
      ],
      distribution: [
        {
          '@type': 'DataDownload',
          encodingFormat: 'text/csv',
          contentUrl: `${site}/${config.csvFile}`,
          name: copy.head.csvTitle,
        },
      ],
      hasPart: [ref(id('projects'))],
    },
    {
      '@type': 'ItemList',
      '@id': id('projects'),
      name: ld.itemList.name,
      ...(ld.itemList.description ? { description: ld.itemList.description } : {}),
      numberOfItems: records.length,
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      itemListElement: records.map((r, i) => ({ '@type': 'ListItem', position: i + 1, item: ref(id(r.slug)) })),
    },
    ...apps,
  ];
}

function commercialGraph(dir: FullDirectory, site: string): Node[] {
  const { config } = dir;
  const { copy } = config;
  const base = `${site}${config.path}`;
  const id = (frag: string) => `${base}#${frag}`;
  const org = `${site}/#org`;
  const records = defaultOrder(dir);
  const ld = copy.ld;
  const segLabel = (r: FullRecord) => dir.segments.find((s) => s.key === r.segment)?.label ?? r.segment;

  const app = (r: FullRecord): Node => {
    const c = r.commercial!;
    return {
      '@type': 'SoftwareApplication',
      '@id': id(r.slug),
      name: r.name,
      url: r.url,
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'Task and project management',
      operatingSystem: c.platforms,
      description: r.blurb,
      author: { '@type': 'Organization', name: r.modelSub },
      featureList: config.capabilities.filter((k) => r.caps[k.key]?.level === 2).map((k) => k.sr),
      additionalProperty: [
        ...config.criteria.map((k) => prop(k.name, dec(r.scores[k.key]!.score), true)),
        prop('Built for', segLabel(r)),
        prop('Market presence', bandLabel(r.band)),
        prop('Estimated integrations', bare(r.integrationsLabel)),
        prop('Free plan', c.freePlan),
        prop('Research confidence', r.confidence),
      ],
      ...(c.listPrice !== null
        ? {
            offers: {
              '@type': 'Offer',
              price: c.listPrice.toFixed(2),
              priceCurrency: 'USD',
              description: c.priceNote,
            },
          }
        : {}),
    };
  };

  return [
    { '@type': 'Organization', '@id': org, name: 'todoi.org', url: `${site}/`, email: 'info@todoi.org' },
    { '@type': 'WebSite', '@id': `${site}/#website`, name: 'todoi.org', url: `${site}/`, publisher: ref(org), inLanguage: 'en' },
    {
      '@type': 'WebPage',
      '@id': id('webpage'),
      url: base,
      name: copy.head.title,
      description: copy.head.description,
      isPartOf: ref(`${site}/#website`),
      about: ref(id('dataset')),
      mainEntity: ref(id('products')),
      inLanguage: 'en',
      datePublished: config.compiledOn,
      dateModified: config.modifiedOn,
      lastReviewed: config.modifiedOn,
      reviewedBy: ref(org),
      breadcrumb: ref(id('breadcrumb')),
    },
    {
      '@type': 'BreadcrumbList',
      '@id': id('breadcrumb'),
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Directory', item: `${site}/` },
        { '@type': 'ListItem', position: 2, name: 'Commercial task managers', item: base },
      ],
    },
    {
      '@type': 'ItemList',
      '@id': id('products'),
      name: ld.itemList.name,
      numberOfItems: records.length,
      itemListOrder: 'https://schema.org/ItemListUnordered',
      itemListElement: records.map((r, i) => ({ '@type': 'ListItem', position: i + 1, item: app(r) })),
    },
    {
      '@type': 'Dataset',
      '@id': id('dataset'),
      name: ld.dataset.name,
      description: ld.dataset.description,
      url: base,
      creator: ref(org),
      dateModified: config.modifiedOn,
      ...(ld.dataset.license ? { license: ld.dataset.license } : {}),
      isAccessibleForFree: true,
      distribution: [{ '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `${site}/${config.csvFile}` }],
    },
    {
      '@type': 'FAQPage',
      '@id': id('faq'),
      mainEntity: config.faqs.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: htmlToText(f.answer) },
      })),
    },
  ];
}

export function directoryGraph(dir: FullDirectory, siteUrl: string): { '@context': string; '@graph': Node[] } {
  const site = siteUrl.replace(/\/+$/, '');
  return {
    '@context': 'https://schema.org',
    '@graph': dir.config.kind === 'oss' ? ossGraph(dir, site) : commercialGraph(dir, site),
  };
}

/**
 * Serialised for a <script> element: one node per line as published, scores
 * with their decimal (3.0, not 3), and "<" escaped so no string can close the
 * element.
 */
export function serializeGraph(graph: ReturnType<typeof directoryGraph>): string {
  // A score is a marker object while the tree is built; here it becomes a
  // placeholder string, then the bare number with its one decimal.
  const marked = (_k: string, x: unknown) =>
    x && typeof x === 'object' && ONE_DECIMAL in x ? `\u0000${(x as { [ONE_DECIMAL]: number })[ONE_DECIMAL].toFixed(1)}\u0000` : x;
  const json = (v: unknown): string => JSON.stringify(v, marked).replace(/"\\u0000([\d.]+)\\u0000"/g, '$1');
  const body = graph['@graph'].map((n) => json(n)).join(',\n');
  return `{"@context":"${graph['@context']}","@graph":[\n${body}\n]}`.replace(/</g, '\\u003c');
}

/** The graph as a <script> block, for the end of the page's <body>. */
export function jsonLdScript(dir: FullDirectory, siteUrl: string): string {
  return `<!-- Structured data sits last so the visible page streams first. -->\n<script type="application/ld+json">${serializeGraph(directoryGraph(dir, siteUrl))}</script>`;
}
