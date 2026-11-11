import { createFileRoute, notFound } from '@tanstack/react-router';
import { z } from 'zod';
import { AdminPage } from '../features/admin/AdminPage.tsx';

/**
 * TEMP(json-store): the editor is switched off. The site runs on the seed
 * file (packages/db/seed/data.json) with no database, so there is nothing to
 * sign in to and nothing to write to; records change by editing that file
 * and committing. While this is false, /admin is an unknown address like any
 * other: the server renders the 404 page and the editor's chunk is never
 * loaded. The editor itself (features/admin) is kept whole.
 *
 * Set it back to true only together with the server side: docs/json-store.md.
 */
const EDITOR_ENABLED: boolean = false;

/**
 * The editor: client-only (never server-rendered), and its own chunk through
 * route code splitting, so the public pages never download it.
 */
export const Route = createFileRoute('/admin')({
  // Switched off, the route is rendered on the server so that the 404 is a real one.
  ssr: EDITOR_ENABLED ? false : undefined,
  beforeLoad: () => {
    if (!EDITOR_ENABLED) throw notFound();
  },
  validateSearch: z.object({
    dir: z.string().optional().catch(undefined),
    record: z.string().optional().catch(undefined),
  }),
  head: () => ({
    meta: [{ title: 'Editor · todoi.org' }, { name: 'robots', content: 'noindex, nofollow' }],
  }),
  component: AdminPage,
});
