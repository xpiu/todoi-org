import { useEffect } from 'react';
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import type { RouterContext } from '../router.tsx';
import { themeScript } from '../lib/theme-script.ts';
import { NotFound } from '../components/NotFound.tsx';
// Every stylesheet, in cascade order (see styles/modules.ts).
import '../styles/modules.ts';

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
    links: [
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/img/favicon-32.png' },
      { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/img/favicon-16.png' },
      { rel: 'icon', type: 'image/png', sizes: '512x512', href: '/img/favicon-512.png' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/img/apple-touch-icon.png' },
      {
        rel: 'preload',
        href: '/fonts/dmsans-300-800-normal-latin.woff2',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'preload',
        href: '/fonts/dmmono-400-normal-latin.woff2',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
    ],
  }),
  component: RootDocument,
  notFoundComponent: NotFound,
});

function RootDocument() {
  const { assets } = Route.useRouteContext();
  // Marks the page interactive. The server's markup already looks finished (the
  // theme switch even claims a seat before the store has read the real one), so
  // nothing else in it says when React has taken over. The root's effect runs
  // after every child's, so the stores have synced by the time it is set.
  useEffect(() => document.documentElement.setAttribute('data-hydrated', ''), []);
  return (
    // The head script stamps data-theme, data-theme-source and the js class
    // before React hydrates; React never renders those, so it never fights them.
    // data-hydrated likewise comes from the effect above, never from render.
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Two theme colours, one per scheme: HeadContent would merge same-named metas. */}
        <meta name="theme-color" content="#eef2f9" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0d1016" media="(prefers-color-scheme: dark)" />
        {assets.styles.map((href) => (
          <link key={href} rel="stylesheet" href={href} data-asset="style" />
        ))}
        {assets.inlineStyles?.map(({ id, css }) => (
          // Vite's client may already have refreshed the text by hydration; React leaves it.
          <style key={id} data-vite-dev-id={id} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: css }} />
        ))}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {assets.preamble ? (
          <script type="module" data-asset="preamble" dangerouslySetInnerHTML={{ __html: assets.preamble }} />
        ) : null}
      </head>
      <body>
        <Outlet />
        <Scripts />
        {assets.scripts.map((src) => (
          <script key={src} type="module" src={src} data-asset="script" />
        ))}
      </body>
    </html>
  );
}
