import { queryOptions } from '@tanstack/react-query';
import {
  AdminDirectory,
  AdminDirectoryList,
  CapabilityRow,
  FaqRow,
  ScoreRow,
  type CapabilityPut,
  type FaqPut,
  type LoginBody,
  type RecordCreate,
  type RecordPatch,
  type ScorePut,
} from '@todoi/shared';
import { z } from 'zod';
import { client } from '../../lib/http-api.ts';
import { HttpError } from '../../lib/api.ts';

const Session = z.object({ email: z.string(), csrfToken: z.string() });
export type Session = z.infer<typeof Session>;

async function read<T>(res: Response, schema: { parse: (v: unknown) => T }): Promise<T> {
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new HttpError(res.status, body);
  return schema.parse(body);
}

/** The value another editor saved, carried by a 409. */
export function conflictCurrent(err: unknown): unknown {
  if (err instanceof HttpError && err.status === 409) {
    return (err.body as { error?: { current?: unknown } } | null)?.error?.current;
  }
  return undefined;
}

export const adminKeys = {
  session: ['admin', 'session'] as const,
  directories: ['admin', 'directories'] as const,
  directory: (slug: string) => ['admin', 'directory', slug] as const,
};

export const sessionQuery = queryOptions({
  queryKey: adminKeys.session,
  queryFn: async (): Promise<Session | null> => {
    return read(await client.api.v1.auth.session.$get(), Session.nullable());
  },
  staleTime: Infinity,
  retry: false,
});

export const directoriesQuery = queryOptions({
  queryKey: adminKeys.directories,
  queryFn: async () => read(await client.api.v1.admin.directories.$get(), AdminDirectoryList),
});

export function adminDirectoryQuery(slug: string) {
  return queryOptions({
    queryKey: adminKeys.directory(slug),
    queryFn: async () => read(await client.api.v1.admin.directories[':slug'].$get({ param: { slug } }), AdminDirectory),
    staleTime: 0,
  });
}

/** Every write carries the session's CSRF token. */
const csrf = (session: Session) => ({ headers: { 'x-csrf-token': session.csrfToken } });

export const adminApi = {
  async login(body: LoginBody) {
    return read(await client.api.v1.auth.login.$post({ json: body }), Session);
  },
  async logout(session: Session) {
    await read(await client.api.v1.auth.logout.$post({}, csrf(session)), z.object({ ok: z.boolean() }));
  },
  async patchRecord(session: Session, slug: string, record: string, json: RecordPatch) {
    const res = await client.api.v1.admin.directories[':slug'].records[':record'].$patch(
      { param: { slug, record }, json },
      csrf(session),
    );
    return read(res, z.object({ version: z.number() }));
  },
  async putScore(session: Session, slug: string, record: string, criterion: string, json: ScorePut) {
    const res = await client.api.v1.admin.directories[':slug'].records[':record'].scores[':criterion'].$put(
      { param: { slug, record, criterion }, json },
      csrf(session),
    );
    return read(res, ScoreRow);
  },
  async putCapability(session: Session, slug: string, record: string, capability: string, json: CapabilityPut) {
    const res = await client.api.v1.admin.directories[':slug'].records[':record'].capabilities[':capability'].$put(
      { param: { slug, record, capability }, json },
      csrf(session),
    );
    return read(res, CapabilityRow);
  },
  async putFaq(session: Session, slug: string, id: number, json: FaqPut) {
    const res = await client.api.v1.admin.directories[':slug'].faqs[':id'].$put(
      { param: { slug, id: String(id) }, json },
      csrf(session),
    );
    return read(res, FaqRow.omit({ version: true }).extend({ version: z.number() }));
  },
  async createRecord(session: Session, slug: string, json: RecordCreate) {
    const res = await client.api.v1.admin.directories[':slug'].records.$post({ param: { slug }, json }, csrf(session));
    return read(res, z.object({ slug: z.string() }));
  },
  async deleteRecord(session: Session, slug: string, record: string) {
    const res = await client.api.v1.admin.directories[':slug'].records[':record'].$delete(
      { param: { slug, record } },
      csrf(session),
    );
    return read(res, z.object({ ok: z.boolean() }));
  },
};
