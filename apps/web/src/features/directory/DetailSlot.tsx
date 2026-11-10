import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import type { DirectoryConfig, RecordSummary } from '@todoi/shared';
import { recordQuery } from './queries.ts';
import { RecordDetailBody } from './RecordDetail.tsx';

/**
 * Server only: each record's detail, already rendered to HTML. Every record's
 * evidence is in the page for readers without JavaScript and for crawlers,
 * but it is not shipped a second time as data for hydration: the commercial
 * directory's details are two thirds of its weight.
 */
export const SsrDetails = createContext<ReadonlyMap<string, string> | null>(null);

/**
 * A record's detail inside its matrix row. After a server render the HTML
 * is already here and React leaves it alone (the island keeps an empty,
 * unchanging __html on the client, so React never rewrites it). If the row
 * was rendered in the browser instead, the island is empty: the detail is
 * fetched and rendered the ordinary way once the record is opened.
 */
export function RowDetail({ config, record, open }: { config: DirectoryConfig; record: RecordSummary; open: boolean }) {
  const ssr = useContext(SsrDetails);
  const ref = useRef<HTMLDivElement>(null);
  const [needsData, setNeedsData] = useState(false);

  useEffect(() => {
    if (ref.current && ref.current.childElementCount === 0) setNeedsData(true);
  }, []);

  if (needsData) return <FetchedDetail config={config} record={record} enabled={open} />;
  return (
    <div
      ref={ref}
      className="detail"
      dangerouslySetInnerHTML={{ __html: ssr?.get(record.slug) ?? '' }}
      suppressHydrationWarning
    />
  );
}

/** A detail rendered in the browser from the record query: cards, and rows the server did not render. */
export function FetchedDetail({
  config,
  record,
  enabled,
}: {
  config: DirectoryConfig;
  record: RecordSummary;
  enabled: boolean;
}) {
  const { api } = useRouteContext({ from: '__root__' });
  const q = useQuery({ ...recordQuery(api, config.slug, record.slug), enabled });
  if (q.data) {
    return (
      <div className="detail">
        <RecordDetailBody config={config} record={record} detail={q.data} />
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="detail">
        <p className="detail-project">This record could not be loaded. Check the connection and open it again.</p>
      </div>
    );
  }
  return enabled ? (
    <div className="detail" aria-busy="true">
      <p className="detail-project">Loading {record.name}…</p>
    </div>
  ) : null;
}
