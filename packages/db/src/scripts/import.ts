/**
 * One-off importer: reads the published static site and writes the committed
 * seed data. The only code in this repository that reads ../todoi-org-website.
 *
 *   pnpm db:import [path-to-todoi-org-website]
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importDirectory } from '../import/importer.ts';

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

  await mkdir(out, { recursive: true });
  for (const job of jobs) {
    const seed = importDirectory({
      kind: job.kind,
      slug: job.slug,
      path: job.path,
      html: await readFile(join(site, job.page), 'utf8'),
      csv: await readFile(join(site, job.csvFile), 'utf8'),
      csvFile: job.csvFile,
      modifiedOn: lastmod(job.loc),
    });
    const file = join(out, `${job.slug}.json`);
    await writeFile(file, JSON.stringify(seed, null, 2) + '\n');
    console.log(`${job.slug}: ${seed.records.length} records, ${seed.faqs.length} questions → ${file}`);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
