import { Hono } from 'hono';
import { z } from 'zod';
import { Slug } from '@todoi/shared';
import { notFound } from '../errors.ts';
import { zv } from '../middleware/validate.ts';
import { toDetail, toResponse } from '../model.ts';
import type { AppEnv } from '../types.ts';

/** Read-only API: a directory with every record, and one record's prose. */
export const publicApi = new Hono<AppEnv>()
  .get('/directories/:slug', zv('param', z.object({ slug: Slug })), async (c) => {
    const dir = await c.var.store.get(c.req.valid('param').slug);
    if (!dir) throw notFound('Directory');
    c.header('Cache-Control', 'no-cache');
    return c.json(toResponse(dir));
  })
  .get(
    '/directories/:slug/records/:record',
    zv('param', z.object({ slug: Slug, record: Slug })),
    async (c) => {
      const { slug, record } = c.req.valid('param');
      const dir = await c.var.store.get(slug);
      const rec = dir?.records.find((r) => r.slug === record);
      if (!rec) throw notFound('Record');
      c.header('Cache-Control', 'no-cache');
      return c.json(toDetail(rec));
    },
  );
