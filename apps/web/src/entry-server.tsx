import { createRequestHandler, defaultRenderHandler } from '@tanstack/react-router/ssr/server';
import { createAppRouter, type Assets } from './router.tsx';
import type { PublicApi } from './lib/api.ts';

export type { Assets } from './router.tsx';
export type { PublicApi } from './lib/api.ts';

export interface RenderOptions {
  request: Request;
  api: PublicApi;
  assets: Assets;
  siteUrl: string;
}

/** Render one page request to a complete HTML response. */
export function render({ request, api, assets, siteUrl }: RenderOptions): Promise<Response> {
  const handler = createRequestHandler({
    request,
    createRouter: () => createAppRouter({ api, assets, siteUrl }),
  });
  return handler(defaultRenderHandler);
}
