import { RouterClient } from '@tanstack/react-router/ssr/client';
import { hydrateRoot } from 'react-dom/client';
import { createAppRouter, type Assets } from './router.tsx';
import { httpApi } from './lib/http-api.ts';

/**
 * The server rendered the asset tags; reading them back gives the client the
 * exact list it must render again for hydration to match.
 */
function readAssets(): Assets {
  const styles = [...document.querySelectorAll<HTMLLinkElement>('link[data-asset="style"]')].map((l) =>
    l.getAttribute('href')!,
  );
  const scripts = [...document.querySelectorAll<HTMLScriptElement>('script[data-asset="script"]')].map((s) =>
    s.getAttribute('src')!,
  );
  const preamble = document.querySelector('script[data-asset="preamble"]')?.textContent ?? undefined;
  return preamble ? { styles, scripts, preamble } : { styles, scripts };
}

const router = createAppRouter({
  api: httpApi,
  assets: readAssets(),
  // The canonical URL names the public origin the server rendered against.
  siteUrl: new URL(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? location.href).origin,
});

hydrateRoot(document, <RouterClient router={router} />);
