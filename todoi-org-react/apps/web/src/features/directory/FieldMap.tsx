import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { Select } from '@base-ui/react/select';
import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import {
  BAND_LABELS,
  bandLabel,
  bubbleRadius,
  fill,
  forceLabel,
  formatScore,
  LABEL_SIZE,
  mapAxis,
  mapKeys,
  medianOf,
  nearestBubble,
  placeBubbles,
  placeLabels,
  relation,
  relationText,
  scoreOf,
  stepBubble,
  textWidth,
  type Box,
  type Bubble,
  type DirectoryConfig,
  type MapAxis,
  type MapFrame,
  type RecordSummary,
} from '@todoi/shared';
import { TagIcon } from '../../components/icons.tsx';
import { scrollBehavior } from '../../lib/motion.ts';
import { CommBand, Metric, ModelTag } from './cells.tsx';
import { resultText } from './Controls.tsx';
import { useDirectory } from './state.tsx';
import { visibleHost } from './usePageBehaviour.ts';
import { cx } from '../../styles/modules.ts';

/**
 * How a bubble is drawn. On the open-source page the ink is the licence, in
 * the tags' own terms: solid blue is open, amber is open with paid extras
 * (the page's ink for "conditionally true"), a broken blue edge is a product
 * split between open and not, a broken grey one is source you may only read.
 * On the commercial page nothing is open, so the fill answers the question a
 * price cannot: whether there is a free plan.
 */
type Look = 'full' | 'part' | 'split' | 'shut' | 'hollow';

const OSS_LOOK: Record<string, Look> = {
  foss: 'full',
  'open-core': 'part',
  'mixed-source': 'split',
  'source-available': 'shut',
};

function lookOf(record: RecordSummary): Look {
  if (record.kind === 'commercial') return record.free || record.price === 0 ? 'full' : 'hollow';
  return OSS_LOOK[record.model] ?? 'shut';
}

/** The frame the server draws, and the browser too until it has measured its own. */
const DEFAULT_SIZE = { width: 880, height: 546 };
const TICK = 10; // tick figures, a size under the names

function frameFor(size: { width: number; height: number }, y: MapAxis, narrow: boolean): MapFrame {
  const widest = Math.max(...y.ticks.map((t) => textWidth(narrow ? t.short : t.label, TICK)));
  return {
    width: size.width,
    height: size.height,
    left: Math.ceil(widest) + 14,
    right: size.width - 12,
    top: 28,
    bottom: size.height - 46,
  };
}

/** The tick figures along the bottom: in full where they fit side by side, short or thinned where they do not. */
function bottomTicks(x: MapAxis, frame: MapFrame, pad: number) {
  const span = frame.right - frame.left - 2 * pad;
  const seat = (at: number) => frame.left + pad + at * span;
  const fits = (labels: string[], step: number) =>
    x.ticks.every((t, i) => {
      if (i % step || i + step >= x.ticks.length) return true;
      const next = x.ticks[i + step]!;
      return seat(next.at) - seat(t.at) >= (textWidth(labels[i]!, TICK) + textWidth(labels[i + step]!, TICK)) / 2 + 8;
    });
  const full = x.ticks.map((t) => t.label);
  const short = x.ticks.map((t) => t.short);
  const [labels, step] = fits(full, 1) ? [full, 1] : fits(short, 1) ? [short, 1] : [short, 2];
  return x.ticks.map((t, i) => ({ x: seat(t.at), label: i % step ? '' : labels[i]! }));
}

function AxisSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange(key: string): void;
}) {
  const { config } = useDirectory();
  const keys = mapKeys(config);
  const groups = config.copy.controls.sortGroups
    .map((g) => ({ ...g, options: g.options.filter((o) => keys.includes(o.value)) }))
    .filter((g) => g.options.length);
  return (
    <div className={cx('map-field')}>
      <label className={cx('control-label')} htmlFor={id}>
        {label}
      </label>
      <Select.Root
        items={groups.flatMap((g) => g.options)}
        value={value}
        onValueChange={(key) => {
          if (typeof key === 'string') onChange(key);
        }}
      >
        <span className={cx('select-wrap')}>
          <Select.Trigger id={id} className={cx('control-select')}>
            <Select.Value className={cx('select-value')} />
          </Select.Trigger>
        </span>
        <Select.Portal>
          <Select.Positioner className={cx('select-positioner')} sideOffset={4} alignItemWithTrigger={false}>
            <Select.Popup className={cx('select-popup')}>
              {groups.map((g) => (
                <Select.Group key={g.label} className={cx('select-group')}>
                  <Select.GroupLabel className={cx('select-group-label')}>{g.label}</Select.GroupLabel>
                  {g.options.map((o) => (
                    <Select.Item key={o.value} value={o.value} className={cx('select-item')}>
                      <Select.ItemText>{o.label}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Group>
              ))}
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}

/** A bubble the size of a legend swatch, in one of the looks. */
function Swatch({ look, r = 5 }: { look: Look; r?: number }) {
  const box = 2 * r + 3;
  return (
    <svg className={cx('map-swatch')} width={box} height={box} viewBox={`0 0 ${box} ${box}`} aria-hidden="true" focusable="false">
      <circle className={cx('map-dot-mark')} data-look={look} cx={box / 2} cy={box / 2} r={r} />
    </svg>
  );
}

/** One figure of the pinned record: its name, a gauge when it is a 1 to 5 score, and the figure. */
function Figure({ label, axis, gauge, children }: { label: string; axis?: 'x' | 'y'; gauge?: number; children: ReactNode }) {
  return (
    <div className={cx('map-fig')} data-axis={axis}>
      <dt className={cx('map-fig-name')}>
        {axis ? (
          <span className={cx('map-fig-axis')} aria-hidden="true">
            {axis === 'x' ? '→' : '↑'}
          </span>
        ) : null}
        {label}
        {axis ? <span className={cx('sr-only')}>{axis === 'x' ? ' (across)' : ' (up)'}</span> : null}
      </dt>
      <dd className={cx('map-fig-val')}>
        {gauge === undefined ? null : (
          <span className={cx('map-fig-bar')} style={{ '--fill': fill(gauge) } as never} aria-hidden="true" />
        )}
        {children}
      </dd>
    </div>
  );
}

/** The record a reader has picked out of the map: every figure the matrix holds for it, and the way to the rest. */
function Pinned({
  config,
  record,
  axes,
  onClose,
  onOpen,
}: {
  config: DirectoryConfig;
  record: RecordSummary;
  axes: [string, string];
  onClose(): void;
  onOpen(): void;
}) {
  const { copy } = config;
  const axisOf = (key: string) => (key === axes[0] ? 'x' : key === axes[1] ? 'y' : undefined);
  const score = scoreOf(record);
  return (
    <div className={cx('map-pin')} data-slug={record.slug}>
      <div className={cx('map-pin-head')}>
        <img className={cx('project-icon map-pin-icon')} src={record.icon} alt="" width={48} height={48} decoding="async" />
        <h3 className={cx('map-pin-name')}>
          <a className={cx('project-name')} href={record.url} rel="noopener external">
            {record.name}
          </a>
        </h3>
        <button type="button" className={cx('map-pin-close')} aria-label={`Unpin ${record.name}`} onClick={onClose}>
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <p className={cx('map-pin-blurb')}>{record.blurb}</p>
      <p className={cx('map-pin-model')}>
        <ModelTag config={config} record={record} />
        <span className={cx('map-pin-sub')}>{record.kind === 'oss' ? record.licence : record.modelSub}</span>
      </p>
      <dl className={cx('map-figs')}>
        <Figure label="Score" axis={axisOf('avg')} gauge={score}>
          <span className={cx('num')}>{formatScore(score)}</span>
        </Figure>
        {config.criteria.map((c) => (
          <Figure key={c.key} label={c.name} axis={axisOf(c.key)} gauge={record.scores[c.key] ?? 1}>
            <span className={cx('num')}>{formatScore(record.scores[c.key] ?? 1)}</span>
          </Figure>
        ))}
        <Figure label={copy.band.name} axis={axisOf('community')}>
          <CommBand band={record.band} pill />
        </Figure>
        <Figure label={copy.cards.metricLabel} axis={axisOf(record.kind === 'oss' ? 'stars' : 'price')}>
          <span className={cx('map-fig-metric')}>
            <Metric record={record} sub="card-lic" />
          </span>
        </Figure>
        <Figure label="Integrations" axis={axisOf('integrations')}>
          <span className={cx('num')}>{record.integrationsLabel}</span>
        </Figure>
        <Figure label={copy.facts.yearLabel} axis={axisOf('year')}>
          <span className={cx('num')}>{record.year}</span>
        </Figure>
      </dl>
      <p className={cx('map-pin-actions')}>
        <button type="button" className={cx('btn btn-primary btn-sm map-pin-open')} onClick={onOpen}>
          Full record
        </button>
      </p>
    </div>
  );
}

/** What the picture plots, while no record is picked out. */
function Reading({ x, y, config }: { x: MapAxis; y: MapAxis; config: DirectoryConfig }) {
  return (
    <div className={cx('map-read')}>
      <h3 className={cx('map-read-title')}>Reading it</h3>
      <dl className={cx('map-read-list')}>
        {(
          [
            ['→', 'Across', x],
            ['↑', 'Up', y],
          ] as const
        ).map(([arrow, way, axis]) => (
          <div className={cx('map-read-item')} key={way}>
            <dt>
              <span className={cx('map-fig-axis')} aria-hidden="true">
                {arrow}
              </span>
              <span className={cx('sr-only')}>{`${way}: `}</span>
              {axis.label}
            </dt>
            {axis.note ? <dd>{axis.note}</dd> : null}
          </div>
        ))}
        <div className={cx('map-read-item')}>
          <dt>
            <span className={cx('map-fig-axis')} aria-hidden="true">
              ○
            </span>
            <span className={cx('sr-only')}>Size: </span>
            {config.copy.band.name}
          </dt>
          <dd>{`An editorial band, ${BAND_LABELS[0]} to ${BAND_LABELS[BAND_LABELS.length - 1]}; not a count.`}</dd>
        </div>
      </dl>
      <p className={cx('map-read-hint')}>
        Select a bubble to pin its figures here.
      </p>
    </div>
  );
}

/**
 * The map: the directory as bubbles, under the matrix it is drawn from. It
 * reads the same filters and search as the matrix (a record they leave out
 * stays as a ghost, so the field keeps its shape), and its two axes live in
 * the address like the rest of the view.
 *
 * The server draws it at a default width so the page is whole without
 * JavaScript; the browser redraws it at the width it actually has.
 */
export function FieldMap() {
  const { config, records, view, visible, update, clearFilters, isOpen, toggle } = useDirectory();
  const { copy } = config;
  const oss = config.kind === 'oss';
  const first = copy.map.views[0]!;
  const [xKey, yKey] = view.map ?? [first.x, first.y];

  const setAxes = (x: string, y: string) => update({ map: x === first.x && y === first.y ? null : [x, y] });

  const canvas = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [live, setLive] = useState(false);
  useLayoutEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const measure = () => {
      const width = Math.round(el.clientWidth);
      const height = Math.round(el.clientHeight);
      if (width && height) setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
    };
    measure();
    // Bubbles glide to a new view, but not into the first measured one.
    const frame = requestAnimationFrame(() => setLive(true));
    if (!('ResizeObserver' in window)) return () => cancelAnimationFrame(frame);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, []);

  const [hover, setHover] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);

  const plot = useMemo(() => {
    const narrow = size.width < 560;
    const x = mapAxis(config, records, xKey);
    const y = mapAxis(config, records, yKey);
    const frame = frameFor(size, y, narrow);
    const base = Math.max(4.2, Math.min(7, size.width / 125));
    const pad = bubbleRadius(5, base) + 3;
    const bubbles = placeBubbles(records, x, y, frame, base);
    const shown = records.filter((r) => visible.has(r.slug));

    // The middle of what is shown, on each axis that is a scale rather than five named steps.
    const taken: Box[] = [];
    const medians: { way: 'x' | 'y'; at: number; label: string }[] = [];
    if (shown.length >= 3) {
      for (const [way, axis] of [
        ['x', x],
        ['y', y],
      ] as const) {
        const m = axis.kind === 'band' ? null : medianOf(shown, axis.key);
        if (m === null) continue;
        const label = `median ${axis.format(axis.kind === 'score' ? Math.round(m * 10) / 10 : m)}`;
        const at =
          way === 'x'
            ? frame.left + pad + axis.place(m) * (frame.right - frame.left - 2 * pad)
            : frame.bottom - pad - axis.place(m) * (frame.bottom - frame.top - 2 * pad);
        medians.push({ way, at: Math.round(at) + 0.5, label });
        const w = textWidth(label, TICK);
        taken.push(
          way === 'x'
            ? { x0: at + 2, y0: frame.top, x1: at + 8 + w, y1: frame.top + 14 }
            : { x0: frame.right - w - 6, y0: at - 14, x1: frame.right, y1: at - 1 },
        );
      }
    }

    const labels = placeLabels(shown, bubbles.filter((b) => visible.has(b.slug)), frame, taken);
    return { narrow, x, y, frame, base, pad, bubbles, shown, medians, labels };
  }, [config, records, visible, xKey, yKey, size]);

  const { x, y, frame, bubbles, shown, labels } = plot;
  const bySlug = useMemo(() => new Map(records.map((r) => [r.slug, r])), [records]);
  const bubbleOf = useMemo(() => new Map(bubbles.map((b) => [b.slug, b])), [bubbles]);
  const live_ = useMemo(() => bubbles.filter((b) => visible.has(b.slug)), [bubbles, visible]);
  // Large first, so a small bubble is never buried under a large one.
  const drawn = useMemo(() => [...bubbles].sort((a, b) => b.r - a.r || a.slug.localeCompare(b.slug)), [bubbles]);

  const pinned = pin && visible.has(pin) ? (bySlug.get(pin) ?? null) : null;
  const active = hover && visible.has(hover) ? hover : focus && visible.has(focus) ? focus : null;
  const activeRecord = active ? (bySlug.get(active) ?? null) : null;
  const activeBubble = active ? (bubbleOf.get(active) ?? null) : null;
  // One bubble is in the tab order; the arrow keys move from it to the rest.
  const rover = (focus && visible.has(focus) ? focus : null) ?? pinned?.slug ?? labels[0]?.slug ?? live_[0]?.slug ?? null;

  const r = relation(shown, x, y);
  const count = resultText(visible.size, records.length, config.nouns);
  const finding =
    visible.size === 0
      ? `No ${config.nouns[0]} matches, so every bubble is greyed out.`
      : relationText(r, x, y) || `${count} shown.`;

  const local = (e: { clientX: number; clientY: number }) => {
    const box = canvas.current!.getBoundingClientRect();
    // Before the first measure the drawing is scaled into its box; afterwards this is 1.
    const k = size.width / (box.width || size.width);
    return [(e.clientX - box.left) * k, (e.clientY - box.top) * k] as const;
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const [px, py] = local(e);
    setHover(nearestBubble(live_, px, py)?.slug ?? null);
  };
  const onClick = (e: MouseEvent) => {
    const [px, py] = local(e);
    const hit = nearestBubble(live_, px, py, 16);
    if (hit) setPin((p) => (p === hit.slug ? null : hit.slug));
  };
  const focusDot = (slug: string) => document.getElementById(`map-dot-${slug}`)?.focus();
  const onKey = (e: KeyboardEvent, b: Bubble) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setPin((p) => (p === b.slug ? null : b.slug));
      return;
    }
    if (e.key === 'Escape') {
      setHover(null);
      setFocus(null);
      return;
    }
    const dir = ({ ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' } as const)[e.key];
    if (!dir) return;
    e.preventDefault();
    const next = stepBubble(live_, b, dir);
    if (next) focusDot(next.slug);
  };

  const openRecord = (slug: string) => {
    if (!isOpen(slug)) toggle(slug);
    // After React has opened it: the open record is taller than the closed one.
    requestAnimationFrame(() => {
      const host = visibleHost(slug);
      host?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
      host?.querySelector<HTMLElement>('.row-expand, .card-expand')?.focus({ preventScroll: true });
    });
  };

  const xTicks = bottomTicks(x, frame, plot.pad);
  const ySeat = (at: number) => frame.bottom - plot.pad - at * (frame.bottom - frame.top - 2 * plot.pad);
  const xSeat = (at: number) => frame.left + plot.pad + at * (frame.right - frame.left - 2 * plot.pad);
  const named = new Set(labels.map((l) => l.slug));
  const extra = pinned && !named.has(pinned.slug) && bubbleOf.has(pinned.slug) ? forceLabel(pinned, bubbleOf.get(pinned.slug)!, frame) : null;

  const chips = config.segments.filter((s) => s.chip !== null);
  const filtered = visible.size < records.length;
  const viewOn = (v: { x: string; y: string }) => v.x === xKey && v.y === yKey;

  const say = (rec: RecordSummary) =>
    [
      rec.name,
      `${x.label}: ${x.text(rec)}`,
      `${y.label}: ${y.text(rec)}`,
      `${copy.band.name}: ${bandLabel(rec.band)}`,
      oss ? (config.segments.find((s) => s.key === rec.segment)?.label ?? '') : rec.kind === 'commercial' && (rec.free || rec.price === 0) ? 'Free plan' : 'No free plan',
    ]
      .filter(Boolean)
      .join('. ');

  // The tooltip sits over its bubble, or under it near the top edge; kept inside the canvas.
  // The pinned record has none: its figures are already beside the map.
  const tip = activeBubble && active !== pinned?.slug && {
    left: `${(Math.max(90, Math.min(activeBubble.x, size.width - 90)) / size.width) * 100}%`,
    top: `${((activeBubble.y < 96 ? activeBubble.y + activeBubble.r + 10 : activeBubble.y - activeBubble.r - 10) / size.height) * 100}%`,
    below: activeBubble.y < 96,
  };

  return (
    <section className={cx('map')} id="map" aria-labelledby="map-title">
      <div className={cx('shell map-inner')}>
        <div className={cx('section-head')}>
          <h2 className={cx('section-title')} id="map-title">
            {copy.map.title}
          </h2>
          <p className={cx('section-note')}>{copy.map.note}</p>
        </div>

        <div className={cx('map-bar')}>
          <div className={cx('map-views')} role="group" aria-labelledby="map-views-label">
            <span className={cx('control-label')} id="map-views-label">
              Views
            </span>
            <div className={cx('map-views-list')}>
              {copy.map.views.map((v) => (
                <button
                  key={v.label}
                  type="button"
                  className={cx('map-view')}
                  aria-pressed={viewOn(v)}
                  onClick={() => setAxes(v.x, v.y)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div className={cx('map-axes')}>
            {/* Picking the figure the other axis already shows swaps the two. */}
            <AxisSelect id="map-x" label="Across" value={xKey} onChange={(k) => setAxes(k, k === yKey ? xKey : yKey)} />
            <button type="button" className={cx('map-swap')} aria-label="Swap axes" title="Swap axes" onClick={() => setAxes(yKey, xKey)}>
              <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M2.5 5.5h11M10.5 2.5l3 3-3 3M13.5 10.5h-11M5.5 7.5l-3 3 3 3" />
              </svg>
            </button>
            <AxisSelect id="map-y" label="Up" value={yKey} onChange={(k) => setAxes(k === xKey ? yKey : xKey, k)} />
          </div>
        </div>

        <div className={cx('map-body')}>
          <figure className={cx('map-plot')}>
            {/* Not a live region: the result count above already speaks for every filter change. */}
            <figcaption className={cx('map-finding')} id="map-finding">
              {finding}
            </figcaption>
            <div className={cx('map-canvas')} ref={canvas} data-live={live ? '' : undefined}>
              <svg
                className={cx('map-svg')}
                viewBox={`0 0 ${size.width} ${size.height}`}
                role="group"
                aria-label={`${y.label} against ${x.label}: ${count}`}
                aria-describedby="map-finding map-help"
                onPointerMove={onMove}
                onPointerLeave={() => setHover(null)}
                onClick={onClick}
              >
                <g aria-hidden="true">
                  {x.lane ? (
                    <rect className={cx('map-lane')} x={xSeat(x.lane.from)} y={frame.top} width={frame.right - xSeat(x.lane.from)} height={frame.bottom - frame.top} />
                  ) : null}
                  {y.lane ? (
                    <rect className={cx('map-lane')} x={frame.left} y={frame.top} width={frame.right - frame.left} height={ySeat(y.lane.from) - frame.top} />
                  ) : null}
                  {y.ticks.map((t, i) => (
                    <g key={`y${i}`}>
                      <line className={cx('map-grid')} x1={frame.left} x2={frame.right} y1={Math.round(ySeat(t.at)) + 0.5} y2={Math.round(ySeat(t.at)) + 0.5} />
                      <text className={cx('map-tick')} x={frame.left - 8} y={ySeat(t.at) + 3.5} textAnchor="end">
                        {plot.narrow ? t.short : t.label}
                      </text>
                    </g>
                  ))}
                  {xTicks.map((t, i) => (
                    <g key={`x${i}`}>
                      <line className={cx('map-grid')} x1={Math.round(t.x) + 0.5} x2={Math.round(t.x) + 0.5} y1={frame.top} y2={frame.bottom} />
                      {t.label ? (
                        <text className={cx('map-tick')} x={t.x} y={frame.bottom + 16} textAnchor="middle">
                          {t.label}
                        </text>
                      ) : null}
                    </g>
                  ))}
                  <text className={cx('map-axis-title')} x={0} y={12}>
                    {`↑ ${y.label}`}
                  </text>
                  <text className={cx('map-axis-title')} x={frame.right} y={size.height - 8} textAnchor="end">
                    {`${x.label} →`}
                  </text>
                  {plot.medians.map((m) =>
                    m.way === 'x' ? (
                      <g key="mx">
                        <line className={cx('map-median')} x1={m.at} x2={m.at} y1={frame.top} y2={frame.bottom} />
                        <text className={cx('map-median-label')} x={m.at + 5} y={frame.top + 10}>
                          {m.label}
                        </text>
                      </g>
                    ) : (
                      <g key="my">
                        <line className={cx('map-median')} x1={frame.left} x2={frame.right} y1={m.at} y2={m.at} />
                        <text className={cx('map-median-label')} x={frame.right - 4} y={m.at - 5} textAnchor="end">
                          {m.label}
                        </text>
                      </g>
                    ),
                  )}
                </g>

                {drawn.map((b) => {
                  const rec = bySlug.get(b.slug)!;
                  const on = visible.has(b.slug);
                  const move = { transform: `translate(${b.x}px, ${b.y}px)` };
                  if (!on) {
                    return (
                      <g key={b.slug} className={cx('map-dot map-dot-ghost')} style={move} aria-hidden="true">
                        <circle className={cx('map-dot-mark')} data-look="ghost" r={b.r} />
                      </g>
                    );
                  }
                  return (
                    <g
                      key={b.slug}
                      id={`map-dot-${b.slug}`}
                      className={cx('map-dot')}
                      style={move}
                      data-slug={b.slug}
                      data-active={b.slug === active ? '' : undefined}
                      data-pinned={b.slug === pinned?.slug ? '' : undefined}
                      role="button"
                      tabIndex={b.slug === rover ? 0 : -1}
                      aria-label={say(rec)}
                      aria-pressed={b.slug === pinned?.slug}
                      onFocus={() => setFocus(b.slug)}
                      onBlur={() => setFocus((f) => (f === b.slug ? null : f))}
                      onKeyDown={(e) => onKey(e, b)}
                    >
                      <circle className={cx('map-dot-ring')} r={b.r + 1.75} />
                      <circle className={cx('map-dot-mark')} data-look={lookOf(rec)} r={b.r} />
                      <circle className={cx('map-dot-halo')} r={b.r + 4} />
                    </g>
                  );
                })}

                <g aria-hidden="true">
                  {[...labels, ...(extra ? [extra] : [])].map((l) => (
                    <text
                      key={l.slug}
                      className={cx('map-name')}
                      data-on={l.slug === active || l.slug === pinned?.slug ? '' : undefined}
                      x={l.x}
                      y={l.y}
                      textAnchor={l.anchor}
                      fontSize={LABEL_SIZE}
                    >
                      {l.text}
                    </text>
                  ))}
                </g>
              </svg>

              {tip && activeRecord ? (
                <div className={cx('map-tip')} data-side={tip.below ? 'below' : 'above'} style={{ left: tip.left, top: tip.top }} aria-hidden="true">
                  <strong className={cx('map-tip-name')}>{activeRecord.name}</strong>
                  <span className={cx('map-tip-row')}>
                    <b>{x.text(activeRecord)}</b> {x.label}
                  </span>
                  <span className={cx('map-tip-row')}>
                    <b>{y.text(activeRecord)}</b> {y.label}
                  </span>
                  {x.kind === 'band' || y.kind === 'band' ? null : (
                    <span className={cx('map-tip-row')}>
                      <b>{bandLabel(activeRecord.band)}</b> {copy.band.name.toLowerCase()}
                    </span>
                  )}
                </div>
              ) : null}
            </div>

            <div className={cx('map-keys')}>
              <div className={cx('map-key')}>
                <span className={cx('map-key-label')}>{copy.band.name}</span>
                <span className={cx('map-key-sizes')}>
                  <span className={cx('map-key-end')}>{BAND_LABELS[0]}</span>
                  {BAND_LABELS.map((name, i) => (
                    <Swatch key={name} look="hollow" r={bubbleRadius(i + 1, plot.base)} />
                  ))}
                  <span className={cx('map-key-end')}>{BAND_LABELS[BAND_LABELS.length - 1]}</span>
                </span>
              </div>
              {oss ? (
                <div className={cx('map-key')}>
                  <span className={cx('map-key-item')}>
                    <Swatch look="split" /> Mixed source
                  </span>
                </div>
              ) : (
                <div className={cx('map-key')}>
                  <span className={cx('map-key-label')}>Free plan</span>
                  <span className={cx('map-key-items')}>
                    <span className={cx('map-key-item')}>
                      <Swatch look="full" /> Yes
                    </span>
                    <span className={cx('map-key-item')}>
                      <Swatch look="hollow" /> No
                    </span>
                  </span>
                </div>
              )}
              <div className={cx('map-key map-key-chips')}>
                <span className={cx('map-key-label')} id="map-chips-label">
                  {copy.controls.chipsLabel}
                </span>
                <ToggleGroup
                  multiple
                  className={cx('map-chips')}
                  aria-labelledby="map-chips-label"
                  value={view.segments}
                  onValueChange={(v) => update({ segments: chips.map((c) => c.key).filter((k) => v.includes(k)) })}
                >
                  {chips.map((s) => (
                    <Toggle key={s.key} value={s.key} className={cx('map-chip')} data-seg={s.key}>
                      {oss ? <Swatch look={OSS_LOOK[s.key] ?? 'shut'} /> : <TagIcon name={s.icon} />}
                      {s.label}
                    </Toggle>
                  ))}
                </ToggleGroup>
              </div>
              <p className={cx('map-count')}>
                <span id="map-count">{`${count} shown`}</span>
                {filtered ? (
                  <button type="button" className={cx('map-clear')} onClick={clearFilters}>
                    Clear filters
                  </button>
                ) : null}
              </p>
            </div>
            <p className={cx('sr-only')} id="map-help">
              Arrow keys move between bubbles; Enter pins one. The matrix above has the same figures as a table.
            </p>
          </figure>

          <aside className={cx('map-side')} aria-label={pinned ? `${pinned.name}, pinned` : 'Reading the map'}>
            {pinned ? (
              <Pinned
                config={config}
                record={pinned}
                axes={[xKey, yKey]}
                onClose={() => {
                  const slug = pinned.slug;
                  setPin(null);
                  focusDot(slug);
                }}
                onOpen={() => openRecord(pinned.slug)}
              />
            ) : (
              <Reading x={x} y={y} config={config} />
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
