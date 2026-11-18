import { createFileRoute } from '@tanstack/react-router';
import { loadStart, directoryHead } from '../../../features/directory/route.ts';
import { StartPage } from '../../../features/directory/StartPage.tsx';

const SLUG = 'commercial';

export const Route = createFileRoute('/commercial-task-managers/where-to-start/')({
  loader: ({ context }) => loadStart(context, SLUG),
  head: ({ loaderData }) => directoryHead(loaderData),
  component: () => <StartPage slug={SLUG} />,
});
