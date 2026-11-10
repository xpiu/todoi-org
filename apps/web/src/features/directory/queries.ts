import { queryOptions } from '@tanstack/react-query';
import type { PublicApi } from '../../lib/api.ts';

/**
 * One factory per resource, shared by the route loader, the components and
 * the server render. The key is the contract; the api decides the transport.
 */
export const directoryKeys = {
  all: ['directory'] as const,
  directory: (slug: string) => ['directory', slug] as const,
  record: (slug: string, record: string) => ['directory', slug, 'record', record] as const,
};

export function directoryQuery(api: PublicApi, slug: string) {
  return queryOptions({
    queryKey: directoryKeys.directory(slug),
    queryFn: () => api.directory(slug),
  });
}

export function recordQuery(api: PublicApi, slug: string, record: string) {
  return queryOptions({
    queryKey: directoryKeys.record(slug, record),
    queryFn: () => api.record(slug, record),
    staleTime: 5 * 60_000,
  });
}
