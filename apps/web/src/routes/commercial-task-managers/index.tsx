import { createFileRoute } from '@tanstack/react-router';
import { DirectorySearch } from '@todoi/shared';
import { DirectoryPage } from '../../features/directory/DirectoryPage.tsx';
import { directoryHead, loadDirectory } from '../../features/directory/route.ts';

const SLUG = 'commercial';

export const Route = createFileRoute('/commercial-task-managers/')({
  validateSearch: DirectorySearch,
  loader: ({ context }) => loadDirectory(context, SLUG),
  head: ({ loaderData }) => directoryHead(loaderData),
  component: () => <DirectoryPage slug={SLUG} />,
});
