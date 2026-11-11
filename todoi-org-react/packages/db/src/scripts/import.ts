/**
 * One-off importer: reads the published static site and writes the committed
 * seed data, packages/db/seed/data.json. The only code in this repository that
 * reads ../todoi-org-website.
 *
 *   pnpm db:import [path-to-todoi-org-website]
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importDirectory } from '../import/importer.ts';
import { SeedData } from '../seed-schema.ts';
import current from '../../seed/data.json' with { type: 'json' };

const here = fileURLToPath(new URL('.', import.meta.url));
const site = resolve(process.argv[2] ?? join(here, '../../../../../todoi-org-website'));
const out = resolve(here, '../../seed');

async function main() {
  // The sitemap's lastmod is the date each page last changed.
  const sitemap = await readFile(join(site, 'sitemap.xml'), 'utf8');
  const lastmod = (loc: string) => {
    const m = new RegExp(`<loc>${loc.replace(/[/.]/g, '\\$&')}</loc>\\s*<lastmod>([^<]+)</lastmod>`).exec(sitemap);
    if (!m?.[1]) throw new Error(`no lastmod for ${loc}`);
    return m[1];
  };

  const jobs = [
    {
      kind: 'oss' as const,
      slug: 'open-source',
      path: '/',
      page: 'index.html',
      csvFile: 'todoi-dataset-2026-09-17.csv',
      loc: 'https://todoi.org/',
    },
    {
      kind: 'commercial' as const,
      slug: 'commercial',
      path: '/commercial-task-managers/',
      page: 'commercial-task-managers/index.html',
      csvFile: 'todoi-commercial-dataset-2026-11-10.csv',
      loc: 'https://todoi.org/commercial-task-managers/',
    },
  ];

  // llms.txt: hand-written prose around one generated line per record. Split it
  // at the record lines so each directory keeps the prose that introduces it.
  const llms = await readFile(join(site, 'llms.txt'), 'utf8');
  const lines = llms.split('\n');
  const isRecord = (l: string) => /^- \[[^\]]+\]\([^)]+\): /.test(l);
  const runs: [number, number][] = [];
  lines.forEach((l, i) => {
    const last = runs[runs.length - 1];
    if (!isRecord(l)) return;
    if (last && last[1] === i - 1) last[1] = i;
    else runs.push([i, i]);
  });
  // The record runs are the two longest runs of record lines, in page order.
  const [ossRun, comRun] = [...runs].sort((a, b) => b[1] - b[0] - (a[1] - a[0])).slice(0, 2).sort((a, b) => a[0] - b[0]);
  if (!ossRun || !comRun) throw new Error('llms.txt: record lines not found');
  const part = (from: number, to: number) => lines.slice(from, to).join('\n');
  const llmsParts = {
    'open-source': { before: part(0, ossRun[0]), after: '' },
    commercial: { before: part(ossRun[1] + 1, comRun[0]), after: part(comRun[1] + 1, lines.length) },
  } as const;

  const directories = [];
  for (const job of jobs) {
    const seed = importDirectory({
      kind: job.kind,
      slug: job.slug,
      path: job.path,
      html: await readFile(join(site, job.page), 'utf8'),
      csv: await readFile(join(site, job.csvFile), 'utf8'),
      csvFile: job.csvFile,
      modifiedOn: lastmod(job.loc),
      llms: llmsParts[job.slug as keyof typeof llmsParts],
      // Not all of it is on the page: carried over from the seed being replaced.
      source: SeedData.parse(current).directories.find((d) => d.slug === job.slug)!.copy.source,
    });
    directories.push(seed);
    console.log(`${job.slug}: ${seed.records.length} records, ${seed.faqs.length} questions`);
  }
  // One file for every directory, in page order: that order decides the ids.
  const file = join(out, 'data.json');
  await mkdir(out, { recursive: true });
  await writeFile(file, JSON.stringify(SeedData.parse({ directories }), null, 2) + '\n');
  console.log(`→ ${file}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
