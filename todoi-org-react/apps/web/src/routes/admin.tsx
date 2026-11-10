import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { AdminPage } from '../features/admin/AdminPage.tsx';

/**
 * The editor: client-only (never server-rendered), and its own chunk through
 * route code splitting, so the public pages never download it.
 */
export const Route = createFileRoute('/admin')({
  ssr: false,
  validateSearch: z.object({
    dir: z.string().optional().catch(undefined),
    record: z.string().optional().catch(undefined),
  }),
  head: () => ({
    meta: [{ title: 'Editor · todoi.org' }, { name: 'robots', content: 'noindex, nofollow' }],
  }),
  component: AdminPage,
});
