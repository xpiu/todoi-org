/**
 * TEMP(json-store): the directories, read straight from the committed seed.
 *
 * Until the site needs PostgreSQL again (sign-in, the editor, configuration,
 * social features), nothing is running a database: seed/data.json is the
 * data, bundled into the server, and a record changes by editing it and
 * committing. This module is the whole of that store. It returns exactly what
 * `loadFullDirectory` (queries.ts) returns from a freshly seeded database, so
 * everything downstream (pages, API, CSV, JSON-LD, sitemap, llms.txt) cannot
 * tell the difference. `json.test.ts` holds it to that, against PostgreSQL.
 *
 * It must not import anything that reaches `pg` or `drizzle-orm` at run time:
 * the types below are erased, and seed-schema.ts is Zod only.
 *
 * The way back is in docs/json-store.md.
 */
import { mapKeys, sourceClass } from '@todoi/shared';
import data from '../seed/data.json' with { type: 'json' };
import type { FullDirectory, FullRecord } from './queries.ts';
import { SeedData, type SeedDirectory } from './seed-schema.ts';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Seed files as the directories the application reads.
 *
 * Ids are the serials PostgreSQL hands out when it is seeded in the same
 * order, and every version is 1: the seed is the only revision there is.
 * The checks are the constraints the database schema enforces (schema.ts);
 * a seed that breaks one stops the server at start, naming the record.
 */
export function directoriesFromSeed(seeds: SeedDirectory[]): FullDirectory[] {
  const next = { directory: 0, record: 0, faq: 0, route: 0, revision: 0 };
  const seen = { slug: new Set<string>(), path: new Set<string>(), csvFile: new Set<string>() };

  return seeds.map((d) => {
    for (const field of ['slug', 'path', 'csvFile'] as const) {
      if (seen[field].has(d[field])) throw new Error(`seed: two directories share the ${field} "${d[field]}"`);
      seen[field].add(d[field]);
    }
    unique(d.criteria.map((c) => c.key), `${d.slug}: criterion`);
    unique(d.capabilities.map((c) => c.key), `${d.slug}: capability`);
    unique(d.segments.map((s) => s.key), `${d.slug}: segment`);
    unique(d.records.map((r) => r.slug), `${d.slug}: record`);

    // A view of the map names two different figures the matrix can sort by.
    const axes = mapKeys(d);
    for (const v of d.copy.map.views) {
      for (const key of [v.x, v.y]) {
        if (!axes.includes(key)) throw new Error(`seed ${d.slug}: the map view "${v.label}" plots "${key}", which is not a figure here`);
      }
      if (v.x === v.y) throw new Error(`seed ${d.slug}: the map view "${v.label}" plots "${v.x}" against itself`);
    }

    const id = ++next.directory;
    const segmentByKey = new Map(d.segments.map((s) => [s.key, s]));
    const criterionKeys = new Set(d.criteria.map((c) => c.key));
    const capabilityKeys = new Set(d.capabilities.map((c) => c.key));

    const records = d.records.map((r): FullRecord => {
      const where = `${d.slug}/${r.slug}`;
      const recordId = ++next.record;
      const segment = segmentByKey.get(r.model);
      if (!segment) throw new Error(`seed ${where}: unknown segment "${r.model}"`);
      if (!SLUG.test(r.slug)) throw new Error(`seed ${where}: the slug is lower case, digits and single hyphens`);
      for (const [key, s] of Object.entries(r.scores)) {
        if (!criterionKeys.has(key)) throw new Error(`seed ${where}: unknown criterion "${key}"`);
        if (s.score < 1 || s.score > 5) throw new Error(`seed ${where}: ${key} score ${s.score} is outside 1 to 5`);
      }
      for (const key of Object.keys(r.caps)) {
        if (!capabilityKeys.has(key)) throw new Error(`seed ${where}: unknown capability "${key}"`);
      }
      // The class is derived from the source map. Where the segment is the licensing
      // label (open source), the two must agree, so a label cannot outlive its facts.
      const derived = sourceClass(r.source);
      if (d.kind === 'oss' && segment.filter !== derived) {
        throw new Error(`seed ${where}: tagged "${segment.key}" but its source map makes it "${derived}"`);
      }
      if (d.kind === 'commercial' && derived !== 'closed' && derived !== 'closed-core') {
        throw new Error(`seed ${where}: its source map makes it "${derived}", which belongs in the open-source directory`);
      }
      for (const [layer, mark] of Object.entries(r.source)) {
        if (mark?.level === 1 && !mark.note) throw new Error(`seed ${where}: the partial "${layer}" mark needs a note saying why`);
      }
      if (r.oss && r.oss.stars < 0) throw new Error(`seed ${where}: stars cannot be negative`);
      if (r.commercial?.price != null && r.commercial.price < 0) throw new Error(`seed ${where}: price cannot be negative`);

      // Keep the directory's criterion and capability order in the maps.
      const scores: FullRecord['scores'] = {};
      for (const c of d.criteria) {
        const s = r.scores[c.key];
        if (s) scores[c.key] = { score: s.score, review: s.review, version: 1 };
      }
      const caps: FullRecord['caps'] = {};
      for (const c of d.capabilities) {
        const s = r.caps[c.key];
        if (s) caps[c.key] = { level: s.level, note: s.note, version: 1 };
      }

      return {
        id: recordId,
        slug: r.slug,
        name: r.name,
        url: r.url,
        icon: r.icon,
        blurb: r.blurb,
        segment: segment.key,
        model: segment.filter,
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
        version: 1,
        scores,
        caps,
        sources: r.sources.map((s) => ({ url: s.url, label: s.label })),
        source: r.source,
        sourceChange: r.sourceChange,
        oss: r.oss ? { recordId, ...r.oss } : null,
        commercial: r.commercial ? { recordId, ...r.commercial } : null,
      };
    });

    const segments = d.segments.map((s) => ({
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

    return {
      id,
      config: {
        slug: d.slug,
        kind: d.kind,
        path: d.path,
        nouns: d.nouns,
        compiledOn: d.compiledOn,
        modifiedOn: d.modifiedOn,
        csvFile: d.csvFile,
        criteria: d.criteria.map(({ key, name, head, sr, tip, text, csv }) => ({ key, name, head, sr, tip, text, csv })),
        capabilities: d.capabilities.map(({ key, label, tip, sr, csv }) => ({ key, label, tip, sr, csv })),
        toggles: d.toggles,
        segments: segments.map(({ csvLabel: _, ...s }) => s),
        copy: d.copy,
        faqs: d.faqs.map((f) => ({ id: ++next.faq, question: f.question, answer: f.answer as never, version: 1 })),
        routes: d.routes.map((r) => ({ id: ++next.route, case: r.case, pick: r.pick as never })),
        revisions: d.revisions.map((r) => ({ id: ++next.revision, date: r.date, text: r.text as never })),
      },
      segments,
      records,
    };
  });
}

function unique(keys: string[], what: string): void {
  const seen = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) throw new Error(`seed ${what} "${key}" appears twice`);
    seen.add(key);
  }
}

/**
 * Every directory in seed/data.json, in file order (the order `pnpm db:seed`
 * writes them, which decides the ids), validated against the seed schema.
 * Throws on a malformed seed.
 */
export function loadSeedDirectories(): FullDirectory[] {
  return directoriesFromSeed(SeedData.parse(data).directories);
}
