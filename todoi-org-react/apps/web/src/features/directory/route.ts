import type { RouterContext } from '../../router.tsx';
import { directoryQuery } from './queries.ts';

/** What the head needs, returned by the loader so it is dehydrated with the page. */
export interface DirectoryHeadData {
  /** Names the directory this page shows; the server render reads it to inline each record's detail. */
  slug: string;
  siteUrl: string;
  path: string;
  csvFile: string;
  head: {
    title: string;
    description: string;
    ogTitle: string;
    ogImage: string;
    ogImageAlt: string;
    csvTitle: string;
  };
}

export async function loadDirectory(context: RouterContext, slug: string): Promise<DirectoryHeadData> {
  const data = await context.queryClient.ensureQueryData(directoryQuery(context.api, slug));
  const d = data.directory;
  return { slug: d.slug, siteUrl: context.siteUrl, path: d.path, csvFile: d.csvFile, head: d.copy.head };
}

/** Title, description, canonical, Open Graph and Twitter tags: rendered on the server. */
export function directoryHead(data: DirectoryHeadData | undefined) {
  if (!data) return {};
  const { head, siteUrl, path, csvFile } = data;
  const url = `${siteUrl}${path}`;
  return {
    meta: [
      { title: head.title },
      { name: 'description', content: head.description },
      { name: 'robots', content: 'index,follow,max-snippet:-1,max-image-preview:large' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'todoi.org' },
      { property: 'og:url', content: url },
      { property: 'og:title', content: head.ogTitle },
      { property: 'og:description', content: head.description },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: head.ogTitle },
      { name: 'twitter:description', content: head.description },
      { property: 'og:image', content: head.ogImage },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: head.ogImageAlt },
      { name: 'twitter:image', content: head.ogImage },
      { name: 'twitter:image:alt', content: head.ogImageAlt },
    ],
    links: [
      { rel: 'canonical', href: url },
      { rel: 'alternate', type: 'text/csv', href: `/${csvFile}`, title: head.csvTitle },
      { rel: 'sitemap', type: 'application/xml', href: '/sitemap.xml' },
    ],
  };
}
