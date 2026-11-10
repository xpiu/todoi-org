import { hc } from 'hono/client';
import { DirectoryResponse, RecordDetail } from '@todoi/shared';
import type { AppType } from '@todoi/server/app';
import { HttpError, type PublicApi } from './api.ts';

/** Typed client for the Hono app: routes, params and bodies come from the server's own type. */
export const client = hc<AppType>('/', {
  init: { credentials: 'same-origin' },
});

async function json<T>(res: Response, schema: { parse: (v: unknown) => T }): Promise<T> {
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new HttpError(res.status, body);
  return schema.parse(body);
}

export const httpApi: PublicApi = {
  async directory(slug) {
    const res = await client.api.v1.directories[':slug'].$get({ param: { slug } });
    return json(res, DirectoryResponse);
  },
  async record(directory, slug) {
    const res = await client.api.v1.directories[':slug'].records[':record'].$get({
      param: { slug: directory, record: slug },
    });
    return json(res, RecordDetail);
  },
};
