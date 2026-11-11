import type { FullDirectory, FullRecord } from '@todoi/db';
import {
  bandLabel,
  computeScore,
  formatScore,
  sortRecords,
  sourceClass,
  sourceWord,
  toCsv,
  DEFAULT_SORT_DIR,
  DEFAULT_SORT_KEY,
  type SourceLayerKey,
} from '@todoi/shared';
import { toSummary } from '../model.ts';

const LEVEL = ['NO', 'PARTIAL', 'NATIVE'] as const;

/** Records in the order the page opens in: by the band, largest first, ties alphabetical. */
export function defaultOrder(dir: FullDirectory): FullRecord[] {
  const bySlug = new Map(dir.records.map((r) => [r.slug, r]));
  return sortRecords(
    dir.records.map((r) => toSummary(dir, r)),
    DEFAULT_SORT_KEY,
    DEFAULT_SORT_DIR,
  ).map((s) => bySlug.get(s.slug)!);
}

function scoreCols(dir: FullDirectory, r: FullRecord): string[] {
  return dir.config.criteria.flatMap((c) => {
    const s = r.scores[c.key]!;
    return [formatScore(s.score), s.review];
  });
}

function capCols(dir: FullDirectory, r: FullRecord): string[] {
  return dir.config.capabilities.map((c) => LEVEL[r.caps[c.key]?.level ?? 0]);
}

function segLabel(dir: FullDirectory, r: FullRecord): string {
  return dir.segments.find((s) => s.key === r.segment)!.csvLabel;
}

/** The page groups thousands ("1,500-2,000"); the dataset never did ("1500-2000"). */
function bareNumbers(label: string): string {
  return label.replace(/(\d),(?=\d{3}\b)/g, '$1');
}

function price(n: number | null): string {
  return n === null ? '' : String(n);
}

/**
 * The source map as five columns: the class it adds up to, then one per layer.
 * A layer reads "Open: AGPL-3.0", "Partly open: ... " with its note, "Closed"
 * or "None". They close the row, so no earlier column changes position.
 */
function sourceHead(dir: FullDirectory): string[] {
  return ['Source_Model', ...dir.config.copy.source.layers.map((l) => l.csv)];
}

function sourceCols(dir: FullDirectory, r: FullRecord): string[] {
  const { classes, layers } = dir.config.copy.source;
  const key = sourceClass(r.source);
  return [
    classes[key]?.label ?? key,
    ...layers.map((l) => {
      const mark = r.source[l.key as SourceLayerKey] ?? null;
      const word = sourceWord(mark);
      if (!mark) return word;
      const label = mark.label === word ? word : `${word}: ${mark.label}`;
      return mark.note ? `${label}. ${mark.note}` : label;
    }),
  ];
}

/** The dataset as published: same columns, same order, same quoting. */
export function directoryCsv(dir: FullDirectory): string {
  const { criteria, capabilities, kind, compiledOn } = dir.config;
  const crit = criteria.flatMap((c) => [`${c.csv}_Score_1_5`, `${c.csv}_Review`]);
  const caps = capabilities.map((c) => c.csv);
  const records = defaultOrder(dir);

  if (kind === 'oss') {
    const head = [
      'Name',
      'Primary_URL',
      'Repository_URL',
      'First_Appeared_Year',
      'Open_Source_Model',
      'License',
      'Short_Description',
      'Community_Size_Category',
      'Community_Proxy_Evidence',
      `GitHub_Stars_${compiledOn.replace(/-/g, '_')}`,
      'GitHub_Stars_Caveat',
      'Estimated_External_Integrations',
      'Integration_Notes',
      ...caps,
      'Deployment',
      'Calendar_Sync',
      'Data_Out',
      'Stack',
      'Hosted_Option',
      ...crit,
      'Activity_or_Caveat',
      'Research_Confidence',
      'Source_URLs',
      ...sourceHead(dir),
    ];
    const rows = records.map((r) => {
      const o = r.oss!;
      return [
        r.name,
        r.url,
        o.repository,
        String(r.year),
        segLabel(dir, r),
        o.licence,
        r.blurb,
        bandLabel(r.band),
        r.bandEvidence,
        String(o.stars),
        o.starsNote ?? '',
        r.integrationsLabel,
        r.integrationNotes,
        ...capCols(dir, r),
        o.deployment,
        r.calendarSync,
        r.dataOut,
        o.stack,
        o.hostedOption,
        ...scoreCols(dir, r),
        r.caveat,
        r.confidence,
        r.sources.map((s) => s.url).join(' | '),
        ...sourceCols(dir, r),
      ];
    });
    return toCsv([head, ...rows]);
  }

  const head = [
    'Name',
    'URL',
    'Vendor',
    'Built_For',
    'First_Launched',
    'Market_Presence',
    'Market_Evidence',
    'Price_USD_Per_User_Month_Billed_Annually',
    'Price_Label',
    'Price_Note',
    'Free_Plan',
    'Free_Plan_Note',
    'Plans',
    'Integrations_Estimate',
    'Integrations_Note',
    ...caps,
    'Hosting',
    'Security',
    'Calendar_Sync',
    'Data_Out',
    'Platforms',
    'AI',
    ...crit,
    'Score_Mean',
    'Summary',
    'Caveat',
    'Research_Confidence',
    'Source_URLs',
    ...sourceHead(dir),
  ];
  const rows = records.map((r) => {
    const c = r.commercial!;
    return [
      r.name,
      r.url,
      c.vendor,
      segLabel(dir, r),
      String(r.year),
      bandLabel(r.band),
      r.bandEvidence,
      price(c.listPrice),
      c.listPriceLabel,
      c.priceNote,
      c.freePlan ? 'YES' : 'NO',
      c.freePlanNote,
      c.plans,
      bareNumbers(r.integrationsLabel),
      r.integrationNotes,
      ...capCols(dir, r),
      c.hosting,
      c.security,
      r.calendarSync,
      r.dataOut,
      c.platforms,
      c.ai,
      ...scoreCols(dir, r),
      formatScore(
        computeScore(
          criteria.map((k) => r.scores[k.key]!.score),
          r.band,
        ),
      ),
      r.summary.join(' '),
      r.caveat,
      r.confidence,
      r.sources.map((s) => s.url).join(' | '),
      ...sourceCols(dir, r),
    ];
  });
  return toCsv([head, ...rows]);
}
