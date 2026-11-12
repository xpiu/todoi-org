import { z } from 'zod';

/**
 * The shape of a directory as the API serves it and the client renders it.
 * The database schema (packages/db) is the source of these fields; these Zod
 * schemas are the boundary contract, shared by the server (which parses its
 * own output in tests) and the client (which infers its types from them).
 */

export const DirectoryKind = z.enum(['oss', 'commercial']);
export type DirectoryKind = z.infer<typeof DirectoryKind>;

/** Inline HTML from the editorial copy: <strong>, <em>, <a href>, <time>. Sanitised on write. */
export const Html = z.string().brand<'Html'>();
export type Html = z.infer<typeof Html>;

/** none / partial / native, as the data-* attributes have always carried them. */
export const Level = z.union([z.literal(0), z.literal(1), z.literal(2)]);
export type Level = z.infer<typeof Level>;
export const LEVEL_NAMES = ['none', 'partial', 'native'] as const;
export type LevelName = (typeof LEVEL_NAMES)[number];

export const Criterion = z.object({
  key: z.string(),
  /** "Ease of deployment" */
  name: z.string(),
  /** Column head when the lead score shows this criterion: "Deploy". */
  head: z.string(),
  /** Screen-reader name: "Ease of deployment". */
  sr: z.string(),
  /** Method tooltip, without the shared tail. */
  tip: z.string(),
  /** The method section's description. */
  text: z.string(),
  /** CSV column prefix: "Ease_of_Deployment". */
  csv: z.string(),
});
export type Criterion = z.infer<typeof Criterion>;

export const Capability = z.object({
  key: z.string(),
  /** Short label on the record: "Time". */
  label: z.string(),
  /** Method tooltip on that label. */
  tip: z.string(),
  /** Screen-reader name: "Native time tracking". */
  sr: z.string(),
  /** CSV column: "Time_Tracking". */
  csv: z.string(),
});
export type Capability = z.infer<typeof Capability>;

/** A must-have filter: a capability, or (commercial) the free plan. */
export const FilterToggle = z.object({
  key: z.string(),
  /** Visible label beside the icon: "Time". */
  label: z.string(),
  /** Accessible name and title when it differs from the label: "Time tracking". */
  title: z.string().nullable(),
  /** Name on an empty-state token: "Time tracking". */
  token: z.string(),
  /** Phrase inside the empty-state sentence: "time tracking". */
  inline: z.string().nullable(),
  icon: z.string(),
});
export type FilterToggle = z.infer<typeof FilterToggle>;

/**
 * How open one layer of a product is. The levels read as they do for a
 * capability: 2 is an open-source licence, 1 is partly open or open with
 * conditions (the note says which), 0 is closed. A layer the product does not
 * have is null in the map, not a mark.
 */
export const SourceMark = z.object({
  level: Level,
  /** What the tile prints under the layer's name: "AGPL-3.0", "Closed", "MIT editor (Typist)". */
  label: z.string(),
  /** Why a mark needs qualifying; required in spirit for a partial. */
  note: z.string().nullable(),
});
export type SourceMark = z.infer<typeof SourceMark>;

/** The four layers every record answers for, in the order a user meets them. */
export const SOURCE_LAYERS = ['app', 'server', 'extras', 'parts'] as const;
export type SourceLayerKey = (typeof SOURCE_LAYERS)[number];

/**
 * A record's source map: the app you use, the server behind it, the paid
 * extras on top, and the parts the owner publishes separately. The record's
 * class (FOSS, open core, closed core...) is derived from it, never stored:
 * see sourceClass() in source.ts.
 */
export const SourceMap = z.strictObject({
  app: SourceMark.nullable(),
  server: SourceMark.nullable(),
  extras: SourceMark.nullable(),
  parts: SourceMark.nullable(),
});
export type SourceMap = z.infer<typeof SourceMap>;

/** A licensing model (open source) or an audience (commercial). */
export const Segment = z.object({
  key: z.string(),
  /** Tag text: "FOSS", "Teams". */
  label: z.string(),
  /** Chip text when it differs: "Source". Null when the segment has no chip. */
  chip: z.string().nullable(),
  /** Chip accessible name when it differs from the chip text. */
  chipAria: z.string().nullable(),
  /** The chip that selects this segment: "foss-app" answers to "foss". */
  filter: z.string(),
  /** CSS modifier: "foss", "open-core", "source-available", "seg". */
  tagClass: z.string(),
  icon: z.string(),
  /** Tooltip on the tag. */
  tip: z.string(),
  /** Definition in the method section; null when not listed there. */
  definition: z.string().nullable(),
  /** "built for individuals": the empty state's audience phrase. */
  audience: z.string().nullable(),
});
export type Segment = z.infer<typeof Segment>;

export const SortOption = z.object({ value: z.string(), label: z.string() });
export const SortGroup = z.object({ label: z.string(), options: z.array(SortOption) });

export const ColumnHead = z.object({ label: z.string(), tip: z.string() });

/** Everything on the page that is copy rather than records. */
export const DirectoryCopy = z.object({
  head: z.object({
    title: z.string(),
    description: z.string(),
    ogTitle: z.string(),
    ogImage: z.string(),
    ogImageAlt: z.string(),
    csvTitle: z.string(),
  }),
  hero: z.object({ title: z.string(), lede: z.string(), mark: z.boolean() }),
  controls: z.object({
    searchPlaceholder: z.string(),
    sortGroups: z.array(SortGroup),
    togglesLegend: z.string(),
    chipsLabel: z.string(),
    filterSummary: z.string(),
    filterNoun: z.string(),
    toggleToken: z.string(),
    chipToken: z.string(),
  }),
  matrix: z.object({
    caption: z.string(),
    project: ColumnHead,
    model: ColumnHead,
    community: ColumnHead,
    /** Stars (open source) or price (commercial). */
    metric: ColumnHead,
    integrations: ColumnHead,
    year: ColumnHead,
    capsTip: z.string(),
    /** Rows whose icon loads eagerly: the first screenful. The rest load lazily. */
    eagerIcons: z.number().int(),
    updated: Html,
    provenance: Html,
  }),
  cards: z.object({
    blurb: z.boolean(),
    eagerIcons: z.number().int(),
    modelLabel: z.string(),
    communityLabel: z.string(),
    metricLabel: z.string(),
  }),
  facts: z.object({ yearLabel: z.string() }),
  score: z.object({ tip: z.string(), sr: z.string(), critTail: z.string() }),
  band: z.object({
    name: z.string(),
    text: z.string(),
    tips: z.record(z.string(), z.string()),
    tail: z.string(),
  }),
  empty: z.object({
    search: z.string(),
    filtersTitle: z.string(),
    filters: z.string(),
    dynamic: z.boolean(),
  }),
  dirWords: z.record(z.string(), z.tuple([z.string(), z.string()])),
  ascKeys: z.array(z.string()),
  routes: z.object({ title: z.string(), note: z.string() }),
  method: z.object({
    title: z.string(),
    note: z.string(),
    notes: z.array(Html),
    modelsTitle: z.string(),
    modelsNote: Html,
  }),
  contribute: z.object({
    text: z.string(),
    listingTitle: z.string(),
    listing: Html,
    mailSubject: z.string(),
  }),
  /** The source map on every record: its heading, its four layers and the classes they add up to. */
  source: z.object({
    title: z.string(),
    tip: z.string(),
    /** The four layers, keyed app, server, extras, parts. Same shape as a capability. */
    layers: z.array(Capability),
    /** class key → its name and the rule behind it: "closed-core" → "Closed core". */
    classes: z.record(z.string(), z.object({ label: z.string(), tip: z.string() })),
    /** The record fact that dates a licence change: "Licence history". */
    changeLabel: z.string(),
  }),
  /**
   * The map under the matrix: every record as a bubble, set by two of the
   * figures the matrix sorts by. `views` are the pairs worth a button; the
   * first is the one the page opens on. `x` and `y` are sort keys.
   */
  map: z.object({
    title: z.string(),
    note: z.string(),
    views: z.array(z.object({ label: z.string(), x: z.string(), y: z.string() })).min(1),
  }),
  crosslink: z.object({ href: z.string(), title: z.string(), text: z.string() }),
  footer: z.object({ note: z.string(), otherLabel: z.string(), otherHref: z.string() }),
  /**
   * llms.txt is one file for the site: prose written by hand around one generated
   * line per record. `before` precedes this directory's lines; `after` (set on the
   * last directory only) closes the file.
   */
  llms: z.object({ before: z.string(), after: z.string() }),
  /** The fixed strings of the page's JSON-LD graph; everything per record is derived. */
  ld: z.object({
    org: z.object({
      description: z.string().nullable(),
      foundingDate: z.string().nullable(),
      knowsAbout: z.array(z.string()).nullable(),
    }),
    websiteDescription: z.string().nullable(),
    dataset: z.object({
      name: z.string(),
      description: z.string(),
      measurementTechnique: z.string().nullable(),
      keywords: z.array(z.string()).nullable(),
      license: z.string().nullable(),
      /** Variables named after the criteria, in order. */
      variables: z.array(z.string()).nullable(),
    }),
    itemList: z.object({ name: z.string(), description: z.string().nullable() }),
  }),
});
export type DirectoryCopy = z.infer<typeof DirectoryCopy>;

export const Faq = z.object({ id: z.number(), question: z.string(), answer: Html, version: z.number() });
export type Faq = z.infer<typeof Faq>;
export const Route = z.object({ id: z.number(), case: z.string(), pick: Html });
export type Route = z.infer<typeof Route>;
export const Revision = z.object({ id: z.number(), date: z.string(), text: Html });
export type Revision = z.infer<typeof Revision>;

export const DirectoryConfig = z.object({
  slug: z.string(),
  kind: DirectoryKind,
  path: z.string(),
  /** ["project", "projects"] */
  nouns: z.tuple([z.string(), z.string()]),
  /** "2026-09-17": the date the dataset was compiled. */
  compiledOn: z.string(),
  /** The page's last change, for the sitemap. */
  modifiedOn: z.string(),
  csvFile: z.string(),
  criteria: z.array(Criterion),
  capabilities: z.array(Capability),
  toggles: z.array(FilterToggle),
  segments: z.array(Segment),
  copy: DirectoryCopy,
  faqs: z.array(Faq),
  routes: z.array(Route),
  revisions: z.array(Revision),
});
export type DirectoryConfig = z.infer<typeof DirectoryConfig>;

const RecordBase = z.object({
  slug: z.string(),
  name: z.string(),
  url: z.string(),
  icon: z.string(),
  blurb: z.string(),
  /** Segment key as tagged: "foss-app". */
  segment: z.string(),
  /** The segment the filter chips read: "foss". */
  model: z.string(),
  /** The line under the tag: licence (open source) or vendor (commercial). */
  modelSub: z.string(),
  year: z.number().int(),
  band: z.number().int().min(1).max(5),
  integrationsLabel: z.string(),
  integrations: z.number().int(),
  /** criterion key → 1.0 to 5.0 */
  scores: z.record(z.string(), z.number()),
  /** capability (and filter) key → 0, 1 or 2 */
  caps: z.record(z.string(), Level),
  /** Lower-case haystack the search reads; derived on the server, never stored. */
  search: z.string(),
  version: z.number().int(),
});

export const OssRecord = RecordBase.extend({
  kind: z.literal('oss'),
  /** The licence in full, as a card prints it under the tag. */
  licence: z.string(),
  stars: z.number().int(),
  starsNote: z.string().nullable(),
});
export const CommercialRecord = RecordBase.extend({
  kind: z.literal('commercial'),
  /** USD per user per month, billed annually; null when sold by quote. */
  price: z.number().nullable(),
  priceLabel: z.string(),
  priceNote: z.string().nullable(),
  pricePublished: z.string().nullable(),
  free: z.boolean(),
});
export const RecordSummary = z.discriminatedUnion('kind', [OssRecord, CommercialRecord]);
export type OssRecord = z.infer<typeof OssRecord>;
export type CommercialRecord = z.infer<typeof CommercialRecord>;
export type RecordSummary = z.infer<typeof RecordSummary>;

export const DirectoryResponse = z.object({
  directory: DirectoryConfig,
  records: z.array(RecordSummary),
});
export type DirectoryResponse = z.infer<typeof DirectoryResponse>;

/** The prose behind a record: what an expanded row shows. */
const DetailBase = z.object({
  slug: z.string(),
  version: z.number().int(),
  summary: z.array(z.string()),
  summaryDate: z.string(),
  /** criterion key → written review */
  reviews: z.record(z.string(), z.string()),
  /** capability key → note, when the check needs one */
  capNotes: z.record(z.string(), z.string()),
  integrationNotes: z.string(),
  bandEvidence: z.string(),
  calendarSync: z.string(),
  dataOut: z.string(),
  caveat: z.string(),
  confidence: z.string(),
  sources: z.array(z.object({ url: z.string(), label: z.string() })),
  /** The source map, and the class derived from it. */
  source: SourceMap,
  sourceClass: z.string(),
  /** A dated licence change, when there has been one. */
  sourceChange: z.string().nullable(),
});
export const OssDetail = DetailBase.extend({
  kind: z.literal('oss'),
  repository: z.string(),
  repositoryUrl: z.string(),
  licence: z.string(),
  modelNote: z.string(),
  deployment: z.string(),
  stack: z.string(),
  hostedOption: z.string(),
  /** Inline HTML: the record's line on its partial or missing capabilities. */
  capabilityNotes: Html.nullable(),
});
export const CommercialDetail = DetailBase.extend({
  kind: z.literal('commercial'),
  yearNote: z.string().nullable(),
  vendor: z.string(),
  plans: z.string(),
  freePlanNote: z.string(),
  hosting: z.string(),
  security: z.string(),
  platforms: z.string(),
  ai: z.string(),
});
export const RecordDetail = z.discriminatedUnion('kind', [OssDetail, CommercialDetail]);
export type OssDetail = z.infer<typeof OssDetail>;
export type CommercialDetail = z.infer<typeof CommercialDetail>;
export type RecordDetail = z.infer<typeof RecordDetail>;
