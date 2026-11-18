import { createFileRoute } from '@tanstack/react-router';
import { loadStart, directoryHead } from '../../features/directory/route.ts';
import { StartPage } from '../../features/directory/StartPage.tsx';

const SLUG = 'open-source';

export const Route = createFileRoute('/where-to-start/')({
  loader: ({ context }) => loadStart(context, SLUG),
  head: ({ loaderData }) => directoryHead(loaderData),
  component: () => <StartPage slug={SLUG} />,
});
