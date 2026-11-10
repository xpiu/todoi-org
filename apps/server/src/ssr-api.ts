import type { DirectoryResponse, RecordDetail } from '@todoi/shared';
import { notFound } from './errors.ts';
import { toDetail, toResponse } from './model.ts';
import type { DirectoryStore } from './store.ts';

/**
 * The page render's view of the API: the same shapes the HTTP endpoints
 * return, read straight from the store, so rendering never calls itself.
 */
export function serverApi(store: DirectoryStore) {
  return {
    async directory(slug: string): Promise<DirectoryResponse> {
      const dir = await store.get(slug);
      if (!dir) throw notFound('Directory');
      return toResponse(dir);
    },
    async record(directory: string, slug: string): Promise<RecordDetail> {
      const dir = await store.get(directory);
      const rec = dir?.records.find((r) => r.slug === slug);
      if (!rec) throw notFound('Record');
      return toDetail(rec);
    },
  };
}
