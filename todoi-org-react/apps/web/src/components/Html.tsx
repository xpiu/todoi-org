import { createElement, type HTMLAttributes } from 'react';
import type { Html as HtmlString } from '@todoi/shared';

/**
 * Editorial copy that carries inline markup (<strong>, <em>, <a>, <time>).
 * The server sanitises it on every write against a short allow-list, and the
 * imported copy came from the published pages, so it is rendered as given.
 */
export function Html({
  as = 'span',
  html,
  ...rest
}: { as?: string; html: HtmlString | string } & HTMLAttributes<HTMLElement>) {
  return createElement(as, { ...rest, dangerouslySetInnerHTML: { __html: html } });
}
