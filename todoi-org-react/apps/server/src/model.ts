import type { FullDirectory, FullRecord } from '@todoi/db';
import { sourceClass, type DirectoryResponse, type Level, type RecordDetail, type RecordSummary } from '@todoi/shared';

/**
 * The lower-case haystack the search box reads, in the static site's exact
 * composition so a search finds what it always found: name, description,
 * licence, model and model note (open source); name, vendor, audience,
 * description and "free plan" (commercial).
 */
export function searchText(dir: FullDirectory, r: FullRecord): string {
  const seg = dir.segments.find((s) => s.key === r.segment);
  const label = seg?.label ?? r.segment;
  const parts =
    dir.config.kind === 'oss'
      ? [r.name, r.blurb, r.oss?.licence ?? '', label, r.oss?.modelNote ?? '']
      : [r.name, r.modelSub, label, r.blurb, r.commercial?.freePlan ? 'free plan' : ''];
  return parts.join(' ').toLowerCase();
}

export function capsOf(r: FullRecord): Record<string, Level> {
  const caps: Record<string, Level> = {};
  for (const [k, v] of Object.entries(r.caps)) caps[k] = v.level;
  // The free plan filters like a capability: a permanent free tier is "native".
  if (r.commercial) caps.free = r.commercial.freePlan ? 2 : 0;
  // So do open parts: a closed product whose owner publishes working parts of it.
  if (r.commercial) caps.parts = r.source.parts?.level ?? 0;
  return caps;
}

export function toSummary(dir: FullDirectory, r: FullRecord): RecordSummary {
  const scores: Record<string, number> = {};
  for (const [k, v] of Object.entries(r.scores)) scores[k] = v.score;
  const base = {
    slug: r.slug,
    name: r.name,
    url: r.url,
    icon: r.icon,
    blurb: r.blurb,
    segment: r.segment,
    model: r.model,
    modelSub: r.modelSub,
    year: r.year,
    band: r.band,
    integrationsLabel: r.integrationsLabel,
    integrations: r.integrations,
    scores,
    caps: capsOf(r),
    search: searchText(dir, r),
    version: r.version,
  };
  if (r.oss) return { ...base, kind: 'oss', licence: r.oss.licence, stars: r.oss.stars, starsNote: r.oss.starsNote };
  const c = r.commercial!;
  return {
    ...base,
    kind: 'commercial',
    price: c.price,
    priceLabel: c.priceLabel,
    priceNote: c.priceDagger,
    pricePublished: c.pricePublished,
    free: c.freePlan,
  };
}

export function toDetail(r: FullRecord): RecordDetail {
  const reviews: Record<string, string> = {};
  for (const [k, v] of Object.entries(r.scores)) reviews[k] = v.review;
  const capNotes: Record<string, string> = {};
  for (const [k, v] of Object.entries(r.caps)) if (v.note) capNotes[k] = v.note;
  const base = {
    slug: r.slug,
    version: r.version,
    summary: r.summary,
    summaryDate: r.summaryDate,
    reviews,
    capNotes,
    integrationNotes: r.integrationNotes,
    bandEvidence: r.bandEvidence,
    calendarSync: r.calendarSync,
    dataOut: r.dataOut,
    caveat: r.caveat,
    confidence: r.confidence,
    sources: r.sources,
    source: r.source,
    sourceClass: sourceClass(r.source),
    sourceChange: r.sourceChange,
  };
  if (r.oss) {
    const o = r.oss;
    return {
      ...base,
      kind: 'oss',
      repository: o.repository,
      repositoryUrl: o.repositoryUrl,
      licence: o.licence,
      modelNote: o.modelNote,
      deployment: o.deployment,
      stack: o.stack,
      hostedOption: o.hostedOption,
      capabilityNotes: o.capabilityNotes as never,
    };
  }
  const c = r.commercial!;
  return {
    ...base,
    kind: 'commercial',
    yearNote: c.yearNote,
    vendor: c.vendor,
    plans: c.plans,
    freePlanNote: c.freePlanNote,
    hosting: c.hosting,
    security: c.security,
    platforms: c.platforms,
    ai: c.ai,
  };
}

export function toResponse(dir: FullDirectory): DirectoryResponse {
  return { directory: dir.config, records: dir.records.map((r) => toSummary(dir, r)) };
}
