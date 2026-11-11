import { asc, eq, inArray } from 'drizzle-orm';
import type { DirectoryConfig, Level, Segment, SourceMap } from '@todoi/shared';
import type { Db } from './index.ts';
import * as t from './schema.ts';

export interface FullRecord {
  id: number;
  slug: string;
  name: string;
  url: string;
  icon: string;
  blurb: string;
  /** Segment as tagged: "foss-app". */
  segment: string;
  /** Segment the filter reads: "foss". */
  model: string;
  modelSub: string;
  summary: string[];
  summaryDate: string;
  year: number;
  band: number;
  bandEvidence: string;
  integrationsLabel: string;
  integrations: number;
  integrationNotes: string;
  calendarSync: string;
  dataOut: string;
  caveat: string;
  confidence: 'High' | 'Medium-high' | 'Medium';
  version: number;
  scores: Record<string, { score: number; review: string; version: number }>;
  caps: Record<string, { level: Level; note: string | null; version: number }>;
  sources: { url: string; label: string }[];
  source: SourceMap;
  sourceChange: string | null;
  oss: typeof t.ossDetails.$inferSelect | null;
  commercial: typeof t.commercialDetails.$inferSelect | null;
}

export interface FullDirectory {
  id: number;
  config: DirectoryConfig;
  segments: (Segment & { csvLabel: string })[];
  records: FullRecord[];
}

export async function listDirectories(db: Db) {
  return db
    .select({ slug: t.directories.slug, path: t.directories.path, csvFile: t.directories.csvFile })
    .from(t.directories)
    .orderBy(asc(t.directories.id));
}

/** Everything a directory holds, in its stored order. Null if there is no such directory. */
export async function loadFullDirectory(db: Db, slug: string): Promise<FullDirectory | null> {
  const [dir] = await db.select().from(t.directories).where(eq(t.directories.slug, slug));
  if (!dir) return null;

  const [crits, caps, segs, faqs, routes, revisions, recs] = await Promise.all([
    db.select().from(t.criteria).where(eq(t.criteria.directoryId, dir.id)).orderBy(asc(t.criteria.position)),
    db.select().from(t.capabilities).where(eq(t.capabilities.directoryId, dir.id)).orderBy(asc(t.capabilities.position)),
    db.select().from(t.segments).where(eq(t.segments.directoryId, dir.id)).orderBy(asc(t.segments.position)),
    db.select().from(t.faqs).where(eq(t.faqs.directoryId, dir.id)).orderBy(asc(t.faqs.position)),
    db.select().from(t.routes).where(eq(t.routes.directoryId, dir.id)).orderBy(asc(t.routes.position)),
    db.select().from(t.revisions).where(eq(t.revisions.directoryId, dir.id)).orderBy(asc(t.revisions.position)),
    db.select().from(t.records).where(eq(t.records.directoryId, dir.id)).orderBy(asc(t.records.id)),
  ]);
  const ids = recs.map((r) => r.id);
  const none = ids.length === 0;
  const [scores, capRows, sources, oss, com] = await Promise.all([
    none ? [] : db.select().from(t.recordScores).where(inArray(t.recordScores.recordId, ids)),
    none ? [] : db.select().from(t.recordCapabilities).where(inArray(t.recordCapabilities.recordId, ids)),
    none
      ? []
      : db
          .select()
          .from(t.recordSources)
          .where(inArray(t.recordSources.recordId, ids))
          .orderBy(asc(t.recordSources.recordId), asc(t.recordSources.position)),
    none ? [] : db.select().from(t.ossDetails).where(inArray(t.ossDetails.recordId, ids)),
    none ? [] : db.select().from(t.commercialDetails).where(inArray(t.commercialDetails.recordId, ids)),
  ]);

  const segById = new Map(segs.map((s) => [s.id, s]));
  const ossBy = new Map(oss.map((o) => [o.recordId, o]));
  const comBy = new Map(com.map((c) => [c.recordId, c]));

  const records: FullRecord[] = recs.map((r) => {
    const seg = segById.get(r.segmentId)!;
    const rs: FullRecord['scores'] = {};
    const rc: FullRecord['caps'] = {};
    // Keep the directory's criterion and capability order in the maps.
    for (const c of crits) {
      const s = scores.find((x) => x.recordId === r.id && x.criterionId === c.id);
      if (s) rs[c.key] = { score: s.score, review: s.review, version: s.version };
    }
    for (const c of caps) {
      const s = capRows.find((x) => x.recordId === r.id && x.capabilityId === c.id);
      if (s) rc[c.key] = { level: s.level as Level, note: s.note, version: s.version };
    }
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      url: r.url,
      icon: r.icon,
      blurb: r.blurb,
      segment: seg.key,
      model: seg.filter,
      modelSub: r.modelSub,
      summary: r.summary,
      summaryDate: r.summaryDate,
      year: r.year,
      band: r.band,
      bandEvidence: r.bandEvidence,
      integrationsLabel: r.integrationsLabel,
      integrations: r.integrations,
      integrationNotes: r.integrationNotes,
      calendarSync: r.calendarSync,
      dataOut: r.dataOut,
      caveat: r.caveat,
      confidence: r.confidence,
      version: r.version,
      scores: rs,
      caps: rc,
      sources: sources.filter((s) => s.recordId === r.id).map((s) => ({ url: s.url, label: s.label })),
      source: r.source,
      sourceChange: r.sourceChange,
      oss: ossBy.get(r.id) ?? null,
      commercial: comBy.get(r.id) ?? null,
    };
  });

  const segments = segs.map((s) => ({
    key: s.key,
    label: s.label,
    chip: s.chip,
    chipAria: s.chipAria,
    filter: s.filter,
    tagClass: s.tagClass,
    icon: s.icon,
    tip: s.tip,
    definition: s.definition,
    audience: s.audience,
    csvLabel: s.csvLabel,
  }));

  const config: DirectoryConfig = {
    slug: dir.slug,
    kind: dir.kind,
    path: dir.path,
    nouns: [dir.nounSingular, dir.nounPlural],
    compiledOn: dir.compiledOn,
    modifiedOn: dir.modifiedOn,
    csvFile: dir.csvFile,
    criteria: crits.map(({ key, name, head, sr, tip, text, csv }) => ({ key, name, head, sr, tip, text, csv })),
    capabilities: caps.map(({ key, label, tip, sr, csv }) => ({ key, label, tip, sr, csv })),
    toggles: dir.toggles,
    segments: segments.map(({ csvLabel: _, ...s }) => s),
    copy: dir.copy,
    faqs: faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer as never, version: f.version })),
    routes: routes.map((r) => ({ id: r.id, case: r.caseText, pick: r.pick as never })),
    revisions: revisions.map((r) => ({ id: r.id, date: r.date, text: r.text as never })),
  };

  return { id: dir.id, config, segments, records };
}
