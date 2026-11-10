import type { DirectoryResponse, RecordDetail } from '@todoi/shared';

/**
 * What the pages need from the server. The browser implementation goes over
 * HTTP (Hono RPC); the server render passes one that reads the database
 * directly, so a page render never makes a request to itself. Both return the
 * same shapes, so the query cache cannot tell them apart.
 */
export interface PublicApi {
  directory(slug: string): Promise<DirectoryResponse>;
  record(directory: string, slug: string): Promise<RecordDetail>;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    const message =
      body && typeof body === 'object' && 'error' in body
        ? String((body as { error: { message?: string } }).error.message ?? status)
        : `HTTP ${status}`;
    super(message);
  }
}
