import { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import type { PublicApi } from './lib/api.ts';
import { routeTree } from './routeTree.gen.ts';

/** The scripts and stylesheets the document must load; resolved per build. */
export interface Assets {
  scripts: string[];
  styles: string[];
  /** Development only: the React refresh preamble Vite needs before any module. */
  preamble?: string;
  /**
   * Development only: every stylesheet's CSS, in cascade order, written into
   * the page so it paints styled before any script runs. Vite's client adopts
   * these tags by their id and updates them on hot reload.
   */
  inlineStyles?: InlineStyle[];
}

export interface InlineStyle {
  /** Vite's module id for the sheet: its absolute file path. */
  id: string;
  css: string;
}

export interface RouterContext {
  queryClient: QueryClient;
  api: PublicApi;
  assets: Assets;
  /** The site origin for canonical URLs: https://todoi.org in production. */
  siteUrl: string;
}

export function createAppRouter(ctx: Omit<RouterContext, 'queryClient'>) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Server data is fresh until something says otherwise: the editor's
        // mutations invalidate, and a page load always gets the newest render.
        staleTime: 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
  const router = createRouter({
    routeTree,
    context: { ...ctx, queryClient },
    trailingSlash: 'preserve',
    scrollRestoration: false,
    defaultPreload: false,
    // Typing in the search box rewrites the URL on every keystroke; that is
    // a view change, never a navigation the scroll position should react to.
    defaultStructuralSharing: true,
  });
  setupRouterSsrQueryIntegration({ router, queryClient });
  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
