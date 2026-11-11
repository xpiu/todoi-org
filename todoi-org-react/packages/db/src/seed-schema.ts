import { z } from 'zod';
import { Capability, Criterion, DirectoryCopy, DirectoryKind, FilterToggle, Level, Segment } from '@todoi/shared';

/**
 * The committed seed: what the importer read from the published site, and
 * what `pnpm db:seed` writes into an empty database. One file per directory.
 *
 * TEMP(json-store): for now these files are not only the seed but the data the
 * site serves (json.ts reads them; no database runs). See docs/json-store.md.
 */
export const SeedRecord = z.object({
  slug: z.string(),
  name: z.string(),
  url: z.string(),
  icon: z.string(),
  blurb: z.string(),
  model: z.string(),
  modelSub: z.string(),
  summary: z.array(z.string()).min(1),
  summaryDate: z.string(),
  year: z.number().int(),
  band: z.number().int().min(1).max(5),
  bandEvidence: z.string(),
  integrationsLabel: z.string(),
  integrations: z.number().int(),
  integrationNotes: z.string(),
  calendarSync: z.string(),
  dataOut: z.string(),
  caveat: z.string(),
  confidence: z.enum(['High', 'Medium-high', 'Medium']),
  scores: z.record(z.string(), z.object({ score: z.number(), review: z.string() })),
  caps: z.record(z.string(), z.object({ level: Level, note: z.string().nullable() })),
  sources: z.array(z.object({ url: z.string(), label: z.string() })),
  oss: z
    .object({
      licence: z.string(),
      modelNote: z.string(),
      repository: z.string(),
      repositoryUrl: z.string(),
      stars: z.number().int(),
      starsNote: z.string().nullable(),
      deployment: z.string(),
      stack: z.string(),
      hostedOption: z.string(),
      capabilityNotes: z.string().nullable(),
    })
    .optional(),
  commercial: z
    .object({
      vendor: z.string(),
      yearNote: z.string().nullable(),
      price: z.number().nullable(),
      priceLabel: z.string(),
      listPrice: z.number().nullable(),
      listPriceLabel: z.string(),
      priceNote: z.string(),
      priceDagger: z.string().nullable(),
      pricePublished: z.string().nullable(),
      freePlan: z.boolean(),
      freePlanNote: z.string(),
      plans: z.string(),
      hosting: z.string(),
      security: z.string(),
      platforms: z.string(),
      ai: z.string(),
    })
    .optional(),
});
export type SeedRecord = z.infer<typeof SeedRecord>;

export const SeedDirectory = z.object({
  slug: z.string(),
  kind: DirectoryKind,
  path: z.string(),
  nouns: z.tuple([z.string(), z.string()]),
  compiledOn: z.string(),
  modifiedOn: z.string(),
  csvFile: z.string(),
  toggles: z.array(FilterToggle),
  copy: DirectoryCopy,
  criteria: z.array(Criterion),
  capabilities: z.array(Capability),
  segments: z.array(Segment.extend({ csvLabel: z.string() })),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })),
  routes: z.array(z.object({ case: z.string(), pick: z.string() })),
  revisions: z.array(z.object({ date: z.string(), text: z.string() })),
  records: z.array(SeedRecord),
});
export type SeedDirectory = z.infer<typeof SeedDirectory>;
