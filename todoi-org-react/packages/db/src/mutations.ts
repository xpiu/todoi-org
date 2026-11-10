import { and, eq, sql } from 'drizzle-orm';
import type { Db } from './index.ts';
import * as t from './schema.ts';

/**
 * Editor writes. Every one names the version it was based on; the UPDATE only
 * matches that version, so of two editors saving the same row, the second
 * gets `stale` back with the row as it now stands, instead of overwriting.
 */
export type WriteResult<T> = { ok: true; row: T } | { ok: false; reason: 'missing' } | { ok: false; reason: 'stale'; current: T };

async function directoryId(db: Db, slug: string): Promise<number | null> {
  const [d] = await db.select({ id: t.directories.id }).from(t.directories).where(eq(t.directories.slug, slug));
  return d?.id ?? null;
}

async function recordRow(db: Db, directory: string, slug: string) {
  const dirId = await directoryId(db, directory);
  if (dirId === null) return null;
  const [r] = await db
    .select()
    .from(t.records)
    .where(and(eq(t.records.directoryId, dirId), eq(t.records.slug, slug)));
  return r ?? null;
}

/** The page changed today: the sitemap's lastmod and the graph's dateModified follow. */
async function touch(db: Db, directoryIdValue: number) {
  await db
    .update(t.directories)
    .set({ modifiedOn: sql`current_date`, updatedAt: sql`now()` })
    .where(eq(t.directories.id, directoryIdValue));
}

export interface RecordFields {
  name?: string;
  url?: string;
  blurb?: string;
  year?: number;
  band?: number;
  integrationsLabel?: string;
  integrations?: number;
  confidence?: 'High' | 'Medium-high' | 'Medium';
  caveat?: string;
  summary?: string[];
}

export async function updateRecord(
  db: Db,
  directory: string,
  slug: string,
  version: number,
  fields: RecordFields,
): Promise<WriteResult<typeof t.records.$inferSelect>> {
  const current = await recordRow(db, directory, slug);
  if (!current) return { ok: false, reason: 'missing' };
  const [row] = await db
    .update(t.records)
    .set({ ...fields, version: sql`${t.records.version} + 1`, updatedAt: sql`now()` })
    .where(and(eq(t.records.id, current.id), eq(t.records.version, version)))
    .returning();
  if (!row) return { ok: false, reason: 'stale', current };
  await touch(db, row.directoryId);
  return { ok: true, row };
}

export async function updateScore(
  db: Db,
  directory: string,
  slug: string,
  criterion: string,
  version: number,
  fields: { score: number; review: string },
): Promise<WriteResult<{ score: number; review: string; version: number }>> {
  const rec = await recordRow(db, directory, slug);
  if (!rec) return { ok: false, reason: 'missing' };
  const [crit] = await db
    .select({ id: t.criteria.id })
    .from(t.criteria)
    .where(and(eq(t.criteria.directoryId, rec.directoryId), eq(t.criteria.key, criterion)));
  if (!crit) return { ok: false, reason: 'missing' };
  const where = and(eq(t.recordScores.recordId, rec.id), eq(t.recordScores.criterionId, crit.id));
  const [row] = await db
    .update(t.recordScores)
    .set({ ...fields, version: sql`${t.recordScores.version} + 1`, updatedAt: sql`now()` })
    .where(and(where, eq(t.recordScores.version, version)))
    .returning({ score: t.recordScores.score, review: t.recordScores.review, version: t.recordScores.version });
  if (!row) {
    const [now] = await db
      .select({ score: t.recordScores.score, review: t.recordScores.review, version: t.recordScores.version })
      .from(t.recordScores)
      .where(where);
    return now ? { ok: false, reason: 'stale', current: now } : { ok: false, reason: 'missing' };
  }
  await touch(db, rec.directoryId);
  return { ok: true, row };
}

export async function updateCapability(
  db: Db,
  directory: string,
  slug: string,
  capability: string,
  version: number,
  fields: { level: number; note: string | null },
): Promise<WriteResult<{ level: number; note: string | null; version: number }>> {
  const rec = await recordRow(db, directory, slug);
  if (!rec) return { ok: false, reason: 'missing' };
  const [cap] = await db
    .select({ id: t.capabilities.id })
    .from(t.capabilities)
    .where(and(eq(t.capabilities.directoryId, rec.directoryId), eq(t.capabilities.key, capability)));
  if (!cap) return { ok: false, reason: 'missing' };
  const where = and(eq(t.recordCapabilities.recordId, rec.id), eq(t.recordCapabilities.capabilityId, cap.id));
  const cols = { level: t.recordCapabilities.level, note: t.recordCapabilities.note, version: t.recordCapabilities.version };
  const [row] = await db
    .update(t.recordCapabilities)
    .set({ ...fields, version: sql`${t.recordCapabilities.version} + 1`, updatedAt: sql`now()` })
    .where(and(where, eq(t.recordCapabilities.version, version)))
    .returning(cols);
  if (!row) {
    const [now] = await db.select(cols).from(t.recordCapabilities).where(where);
    return now ? { ok: false, reason: 'stale', current: now } : { ok: false, reason: 'missing' };
  }
  await touch(db, rec.directoryId);
  return { ok: true, row };
}

export async function updateFaq(
  db: Db,
  directory: string,
  id: number,
  version: number,
  fields: { question: string; answer: string },
): Promise<WriteResult<{ id: number; question: string; answer: string; version: number }>> {
  const dirId = await directoryId(db, directory);
  if (dirId === null) return { ok: false, reason: 'missing' };
  const cols = { id: t.faqs.id, question: t.faqs.question, answer: t.faqs.answer, version: t.faqs.version };
  const where = and(eq(t.faqs.id, id), eq(t.faqs.directoryId, dirId));
  const [row] = await db
    .update(t.faqs)
    .set({ ...fields, version: sql`${t.faqs.version} + 1`, updatedAt: sql`now()` })
    .where(and(where, eq(t.faqs.version, version)))
    .returning(cols);
  if (!row) {
    const [now] = await db.select(cols).from(t.faqs).where(where);
    return now ? { ok: false, reason: 'stale', current: now } : { ok: false, reason: 'missing' };
  }
  await touch(db, dirId);
  return { ok: true, row };
}

export interface NewRecord {
  slug: string;
  name: string;
  url: string;
  blurb: string;
  model: string;
  year: number;
}

/**
 * A new record starts as a first pass: every criterion at 3.0 awaiting its
 * reasoning, no capability claimed, Medium confidence. The editor fills it in.
 */
export async function createRecord(
  db: Db,
  directory: string,
  input: NewRecord,
): Promise<{ ok: true; id: number } | { ok: false; reason: 'missing' | 'exists' | 'segment' }> {
  return db.transaction(async (tx) => {
    const [dir] = await tx.select().from(t.directories).where(eq(t.directories.slug, directory));
    if (!dir) return { ok: false, reason: 'missing' } as const;
    const [seg] = await tx
      .select()
      .from(t.segments)
      .where(and(eq(t.segments.directoryId, dir.id), eq(t.segments.key, input.model)));
    if (!seg) return { ok: false, reason: 'segment' } as const;
    const [dupe] = await tx
      .select({ id: t.records.id })
      .from(t.records)
      .where(and(eq(t.records.directoryId, dir.id), eq(t.records.slug, input.slug)));
    if (dupe) return { ok: false, reason: 'exists' } as const;
    const today = new Date().toISOString().slice(0, 10);
    const pending = 'To be assessed.';
    const [rec] = await tx
      .insert(t.records)
      .values({
        directoryId: dir.id,
        segmentId: seg.id,
        slug: input.slug,
        name: input.name,
        url: input.url,
        icon: '/img/favicon-512.png',
        blurb: input.blurb,
        modelSub: input.name,
        summary: [pending],
        summaryDate: today,
        year: input.year,
        band: 1,
        bandEvidence: pending,
        integrationsLabel: '0',
        integrations: 0,
        integrationNotes: pending,
        calendarSync: pending,
        dataOut: pending,
        caveat: pending,
        confidence: 'Medium',
      })
      .returning({ id: t.records.id });
    const recordId = rec!.id;
    const crits = await tx.select().from(t.criteria).where(eq(t.criteria.directoryId, dir.id));
    const caps = await tx.select().from(t.capabilities).where(eq(t.capabilities.directoryId, dir.id));
    if (crits.length) {
      await tx.insert(t.recordScores).values(crits.map((c) => ({ recordId, criterionId: c.id, score: 3, review: pending })));
    }
    if (caps.length) {
      await tx.insert(t.recordCapabilities).values(caps.map((c) => ({ recordId, capabilityId: c.id, level: 0, note: null })));
    }
    if (dir.kind === 'oss') {
      await tx.insert(t.ossDetails).values({
        recordId,
        licence: pending,
        modelNote: pending,
        repository: input.url.replace(/^https?:\/\//, ''),
        repositoryUrl: input.url,
        stars: 0,
        deployment: pending,
        stack: pending,
        hostedOption: pending,
      });
    } else {
      await tx.insert(t.commercialDetails).values({
        recordId,
        vendor: pending,
        price: null,
        priceLabel: 'Quote',
        listPrice: null,
        listPriceLabel: 'Quote',
        priceNote: pending,
        freePlan: false,
        freePlanNote: pending,
        plans: pending,
        hosting: pending,
        security: pending,
        platforms: 'Web',
        ai: pending,
      });
    }
    await tx.update(t.directories).set({ modifiedOn: sql`current_date` }).where(eq(t.directories.id, dir.id));
    return { ok: true, id: recordId } as const;
  });
}

export async function deleteRecord(db: Db, directory: string, slug: string): Promise<boolean> {
  const rec = await recordRow(db, directory, slug);
  if (!rec) return false;
  await db.delete(t.records).where(eq(t.records.id, rec.id));
  await touch(db, rec.directoryId);
  return true;
}
