import { useSuspenseQuery } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { directoryQuery } from './queries.ts';

/** Spike: proves the server render, the dehydrated cache and hydration hold together. */
export function DirectoryPage({ slug }: { slug: string }) {
  const { api } = useRouteContext({ from: '__root__' });
  const { data } = useSuspenseQuery(directoryQuery(api, slug));
  return (
    <main id="main">
      <h1 className="hero-title">{data.directory.copy.hero.title}</h1>
      <ul>
        {data.records.map((r) => (
          <li key={r.slug}>{r.name}</li>
        ))}
      </ul>
    </main>
  );
}
