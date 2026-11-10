import { renderToStaticMarkup } from 'react-dom/server';
import {
  createRequestHandler,
  renderRouterToString,
  RouterServer,
} from '@tanstack/react-router/ssr/server';
import type { DirectoryResponse, RecordDetail } from '@todoi/shared';
import { createAppRouter, type Assets } from './router.tsx';
import type { PublicApi } from './lib/api.ts';
import { SsrDetails } from './features/directory/DetailSlot.tsx';
import { directoryKeys } from './features/directory/queries.ts';
import { RecordDetailBody } from './features/directory/RecordDetail.tsx';

export type { Assets } from './router.tsx';
export type { PublicApi } from './lib/api.ts';

/** The server's API has one extra: every record's prose at once, for the page's HTML. */
export interface ServerApi extends PublicApi {
  details(slug: string): Promise<ReadonlyMap<string, RecordDetail>>;
}

export interface RenderOptions {
  request: Request;
  api: ServerApi;
  assets: Assets;
  siteUrl: string;
}

/** Render one page request to a complete HTML response. */
export function render({ request, api, assets, siteUrl }: RenderOptions): Promise<Response> {
  const handler = createRequestHandler({
    request,
    createRouter: () => createAppRouter({ api, assets, siteUrl }),
  });
  return handler(async ({ router, responseHeaders }) => {
    // Which directory did the route load? Its records' details go into the HTML.
    const slug = router.state.matches
      .map((m) => (m.loaderData as { slug?: string } | undefined)?.slug)
      .find((s): s is string => typeof s === 'string');
    const html = new Map<string, string>();
    if (slug) {
      const data = router.options.context.queryClient.getQueryData<DirectoryResponse>(directoryKeys.directory(slug));
      const details = await api.details(slug);
      for (const record of data?.records ?? []) {
        const detail = details.get(record.slug);
        if (!detail) continue;
        html.set(
          record.slug,
          renderToStaticMarkup(<RecordDetailBody config={data!.directory} record={record} detail={detail} />),
        );
      }
    }
    return renderRouterToString({
      router,
      responseHeaders,
      children: (
        <SsrDetails.Provider value={html}>
          <RouterServer router={router} />
        </SsrDetails.Provider>
      ),
    });
  });
}
