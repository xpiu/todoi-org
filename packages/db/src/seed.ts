import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import type { Db } from './index.ts';
import * as t from './schema.ts';
import { SeedDirectory } from './seed-schema.ts';

export const SEED_FILES = ['open-source', 'commercial'].map((slug) =>
  fileURLToPath(new URL(`../seed/${slug}.json`, import.meta.url)),
);

export async function readSeeds(files = SEED_FILES): Promise<SeedDirectory[]> {
  return Promise.all(files.map(async (f) => SeedDirectory.parse(JSON.parse(await readFile(f, 'utf8')))));
}

/**
 * Writes the seed into the database in one transaction. With `reset`, the
 * directory tables are emptied first; users and sessions are never touched.
 * Without it, an already-seeded database is left alone.
 */
export async function seedDatabase(db: Db, seeds: SeedDirectory[], opts: { reset?: boolean } = {}): Promise<boolean> {
  return db.transaction(async (tx) => {
    if (opts.reset) {
      await tx.execute(
        sql`truncate ${t.directories}, ${t.criteria}, ${t.capabilities}, ${t.segments}, ${t.records}, ${t.ossDetails}, ${t.commercialDetails}, ${t.recordScores}, ${t.recordCapabilities}, ${t.recordSources}, ${t.faqs}, ${t.routes}, ${t.revisions} restart identity cascade`,
      );
    } else {
      const existing = await tx.select({ id: t.directories.id }).from(t.directories).limit(1);
      if (existing.length) return false;
    }

    for (const d of seeds) {
      const [dir] = await tx
        .insert(t.directories)
        .values({
          slug: d.slug,
          kind: d.kind,
          path: d.path,
          nounSingular: d.nouns[0],
          nounPlural: d.nouns[1],
          compiledOn: d.compiledOn,
          modifiedOn: d.modifiedOn,
          csvFile: d.csvFile,
          toggles: d.toggles,
          copy: d.copy,
        })
        .returning({ id: t.directories.id });
      const directoryId = dir!.id;

      const crits = await tx
        .insert(t.criteria)
        .values(d.criteria.map((c, position) => ({ ...c, directoryId, position })))
        .returning({ id: t.criteria.id, key: t.criteria.key });
      const caps = await tx
        .insert(t.capabilities)
        .values(d.capabilities.map((c, position) => ({ ...c, directoryId, position })))
        .returning({ id: t.capabilities.id, key: t.capabilities.key });
      const segs = await tx
        .insert(t.segments)
        .values(d.segments.map((s, position) => ({ ...s, directoryId, position })))
        .returning({ id: t.segments.id, key: t.segments.key });
      const critId = new Map(crits.map((c) => [c.key, c.id]));
      const capId = new Map(caps.map((c) => [c.key, c.id]));
      const segId = new Map(segs.map((s) => [s.key, s.id]));

      if (d.faqs.length) {
        await tx.insert(t.faqs).values(d.faqs.map((f, position) => ({ directoryId, position, ...f })));
      }
      if (d.routes.length) {
        await tx
          .insert(t.routes)
          .values(d.routes.map((r, position) => ({ directoryId, position, caseText: r.case, pick: r.pick })));
      }
      if (d.revisions.length) {
        await tx.insert(t.revisions).values(d.revisions.map((r, position) => ({ directoryId, position, ...r })));
      }

      for (const r of d.records) {
        const segmentId = segId.get(r.model);
        if (!segmentId) throw new Error(`${r.slug}: unknown segment ${r.model}`);
        const [rec] = await tx
          .insert(t.records)
          .values({
            directoryId,
            segmentId,
            slug: r.slug,
            name: r.name,
            url: r.url,
            icon: r.icon,
            blurb: r.blurb,
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
          })
          .returning({ id: t.records.id });
        const recordId = rec!.id;
        if (r.oss) await tx.insert(t.ossDetails).values({ recordId, ...r.oss });
        if (r.commercial) await tx.insert(t.commercialDetails).values({ recordId, ...r.commercial });
        await tx.insert(t.recordScores).values(
          Object.entries(r.scores).map(([key, s]) => ({
            recordId,
            criterionId: critId.get(key)!,
            score: s.score,
            review: s.review,
          })),
        );
        await tx.insert(t.recordCapabilities).values(
          Object.entries(r.caps).map(([key, c]) => ({
            recordId,
            capabilityId: capId.get(key)!,
            level: c.level,
            note: c.note,
          })),
        );
        if (r.sources.length) {
          await tx.insert(t.recordSources).values(r.sources.map((url, position) => ({ recordId, position, url })));
        }
      }
    }
    return true;
  });
}
