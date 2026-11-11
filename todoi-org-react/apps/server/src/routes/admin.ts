/*
 * PARKED, TEMP(json-store): the editor's API: every write to PostgreSQL goes through here.
 * The site runs on the seed files for now and nothing mounts this
 * (see editor-api.ts). Kept whole and compiled for the return to PostgreSQL:
 * docs/json-store.md.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import {
  createRecord,
  deleteRecord,
  updateCapability,
  updateFaq,
  updateRecord,
  updateScore,
  type FullRecord,
  type WriteResult,
} from '@todoi/db';
import {
  CapabilityPut,
  FaqPut,
  RecordCreate,
  RecordPatch,
  ScorePut,
  Slug,
  type AdminDirectory,
  type AdminRecord,
  type Level,
} from '@todoi/shared';
import { requireEditor } from '../auth.ts';
import { conflict, HttpProblem, notFound } from '../errors.ts';
import { sanitizeInline } from '../html.ts';
import { zv } from '../middleware/validate.ts';
import type { EditorEnv } from '../types.ts';

function toAdmin(r: FullRecord): AdminRecord {
  return {
    slug: r.slug,
    name: r.name,
    url: r.url,
    blurb: r.blurb,
    segment: r.segment,
    year: r.year,
    band: r.band,
    integrationsLabel: r.integrationsLabel,
    integrations: r.integrations,
    confidence: r.confidence,
    caveat: r.caveat,
    summary: r.summary,
    version: r.version,
    scores: r.scores,
    caps: r.caps as AdminRecord['caps'],
  };
}

/** A write's outcome as HTTP: the row, a 404, or a 409 carrying the row as it now stands. */
function settle<T>(result: WriteResult<T>, what: string): T {
  if (result.ok) return result.row;
  if (result.reason === 'missing') throw notFound(what);
  throw conflict(result.current);
}

const dirParam = z.object({ slug: Slug });
const recordParam = z.object({ slug: Slug, record: Slug });

/**
 * The editor's API. Every route needs a session; every write also needs the
 * session's CSRF token and invalidates the public pages, which are rendered
 * again on their next request.
 */
export const adminApi = new Hono<EditorEnv>()
  .use('*', requireEditor)
  .use('*', async (c, next) => {
    await next();
    if (c.req.method !== 'GET' && c.res.status < 400) c.var.store.invalidate();
  })
  .get('/directories', async (c) => {
    const list = await c.var.store.list();
    const dirs = await Promise.all(list.map((d) => c.var.store.get(d.slug)));
    return c.json(dirs.filter((d) => d !== null).map((d) => ({ slug: d.config.slug, path: d.config.path, title: d.config.copy.hero.title })));
  })
  .get('/directories/:slug', zv('param', dirParam), async (c) => {
    const dir = await c.var.store.get(c.req.valid('param').slug);
    if (!dir) throw notFound('Directory');
    const body: AdminDirectory = { directory: dir.config, records: dir.records.map(toAdmin) };
    return c.json(body);
  })
  .patch('/directories/:slug/records/:record', zv('param', recordParam), zv('json', RecordPatch), async (c) => {
    const { slug, record } = c.req.valid('param');
    const { version, ...fields } = c.req.valid('json');
    const row = settle(await updateRecord(c.var.db, slug, record, version, fields), 'Record');
    return c.json({ version: row.version });
  })
  .put(
    '/directories/:slug/records/:record/scores/:criterion',
    zv('param', recordParam.extend({ criterion: z.string().min(1).max(40) })),
    zv('json', ScorePut),
    async (c) => {
      const { slug, record, criterion } = c.req.valid('param');
      const { version, score, review } = c.req.valid('json');
      return c.json(settle(await updateScore(c.var.db, slug, record, criterion, version, { score, review }), 'Score'));
    },
  )
  .put(
    '/directories/:slug/records/:record/capabilities/:capability',
    zv('param', recordParam.extend({ capability: z.string().min(1).max(40) })),
    zv('json', CapabilityPut),
    async (c) => {
      const { slug, record, capability } = c.req.valid('param');
      const { version, level, note } = c.req.valid('json');
      const row = settle(
        await updateCapability(c.var.db, slug, record, capability, version, { level, note: note || null }),
        'Capability',
      );
      return c.json({ ...row, level: row.level as Level });
    },
  )
  .put(
    '/directories/:slug/faqs/:id',
    zv('param', dirParam.extend({ id: z.coerce.number().int().positive() })),
    zv('json', FaqPut),
    async (c) => {
      const { slug, id } = c.req.valid('param');
      const { version, question, answer } = c.req.valid('json');
      // The answer is inline HTML: only an allow-list of tags survives.
      const html = sanitizeInline(answer.trim().startsWith('<p') ? answer : `<p>${answer}</p>`);
      return c.json(settle(await updateFaq(c.var.db, slug, id, version, { question, answer: html }), 'Question'));
    },
  )
  .post('/directories/:slug/records', zv('param', dirParam), zv('json', RecordCreate), async (c) => {
    const result = await createRecord(c.var.db, c.req.valid('param').slug, c.req.valid('json'));
    if (!result.ok) {
      if (result.reason === 'missing') throw notFound('Directory');
      if (result.reason === 'exists') throw new HttpProblem(409, 'conflict', 'A record with that slug already exists.');
      throw new HttpProblem(400, 'bad_request', 'Unknown licensing model or audience.');
    }
    return c.json({ slug: c.req.valid('json').slug }, 201);
  })
  .delete('/directories/:slug/records/:record', zv('param', recordParam), async (c) => {
    const { slug, record } = c.req.valid('param');
    if (!(await deleteRecord(c.var.db, slug, record))) throw notFound('Record');
    return c.json({ ok: true });
  });
