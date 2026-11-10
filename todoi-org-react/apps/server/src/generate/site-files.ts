import type { FullDirectory, FullRecord } from '@todoi/db';
import { computeScore, formatScore } from '@todoi/shared';
import { defaultOrder } from './csv.ts';

/** Every directory page, with the date it last changed. */
export function sitemapXml(dirs: FullDirectory[], siteUrl: string): string {
  const site = siteUrl.replace(/\/+$/, '');
  const urls = dirs
    .map((d) => `  <url>\n    <loc>${site}${d.config.path}</loc>\n    <lastmod>${d.config.modifiedOn}</lastmod>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated from the database; lastmod is the date each page last changed. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function score(dir: FullDirectory, r: FullRecord): string {
  return formatScore(
    computeScore(
      dir.config.criteria.map((c) => r.scores[c.key]!.score),
      r.band,
    ),
  );
}

function recordLine(dir: FullDirectory, r: FullRecord): string {
  if (r.oss) {
    const seg = dir.segments.find((s) => s.key === r.segment)!;
    return `- [${r.name}](${r.url}): ${r.blurb} ${seg.csvLabel}, ${r.oss.licence}. Score ${score(dir, r)}/5, confidence ${r.confidence}. Source: ${r.oss.repositoryUrl}`;
  }
  const c = r.commercial!;
  const cost =
    c.listPrice === null
      ? 'priced by quote'
      : c.listPrice === 0
        ? 'free, with no paid tier'
        : `paid plans from ${c.listPriceLabel} per user per month, billed annually`;
  return `- [${r.name}](${r.url}): ${r.blurb.replace(/\.$/, '')}; ${cost}. Score ${score(dir, r)}/5, confidence ${r.confidence}.`;
}

/**
 * The machine-readable index: the hand-written prose each directory keeps in
 * its copy, around one line per record in the order the page opens in.
 */
export function llmsTxt(dirs: FullDirectory[]): string {
  return dirs
    .map((d, i) => {
      const parts = [d.config.copy.llms.before, ...defaultOrder(d).map((r) => recordLine(d, r))];
      if (i === dirs.length - 1) parts.push(d.config.copy.llms.after);
      return parts.join('\n');
    })
    .join('\n');
}
