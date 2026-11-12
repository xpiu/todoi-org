import { useEffect, useRef, useState } from 'react';
import { Checkbox } from '@base-ui/react/checkbox';
import { CheckboxGroup } from '@base-ui/react/checkbox-group';
import { Field } from '@base-ui/react/field';
import { Input } from '@base-ui/react/input';
import { Select } from '@base-ui/react/select';
import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import { defaultDir, dirWords } from '@todoi/shared';
import { ChevronIcon, FilterIcon, Glyph, TagIcon } from '../../components/icons.tsx';
import { useHydrated } from '../../lib/hydrated.ts';
import { useBoardUi } from '../../lib/stores.ts';
import { useDirectory } from './state.tsx';
import { cx } from '../../styles/modules.ts';

export function resultText(visible: number, total: number, nouns: [string, string]): string {
  const noun = total === 1 ? nouns[0] : nouns[1];
  return `${visible === total ? total : `${visible} of ${total}`} ${noun}`;
}

function SearchField() {
  const { view, update, config } = useDirectory();
  const [value, setValue] = useState(view.q);
  const timer = useRef<number | undefined>(undefined);
  const input = useRef<HTMLInputElement>(null);

  // Clearing from elsewhere (the empty state, Clear filters) empties the box too.
  useEffect(() => {
    setValue((v) => (v.trim() === view.q ? v : view.q));
  }, [view.q]);

  const commit = (q: string) => {
    window.clearTimeout(timer.current);
    update({ q });
  };

  // "/" focuses the search box, unless the reader is already typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
      e.preventDefault();
      input.current?.focus();
      input.current?.select();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Field.Root className={cx('control-field control-field-grow')}>
      <Field.Label className={cx('control-label')}>Search</Field.Label>
      <Input
        ref={input}
        id="q"
        type="search"
        className={cx('control-search')}
        placeholder={config.copy.controls.searchPlaceholder}
        autoComplete="off"
        spellCheck={false}
        value={value}
        onValueChange={(v) => {
          setValue(v);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => update({ q: v }), 120);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(value);
        }}
      />
    </Field.Root>
  );
}

function SortField() {
  const { view, update, config } = useDirectory();
  const { copy } = config;
  const items = copy.controls.sortGroups.flatMap((g) => g.options);
  const words = dirWords(view.sortKey, view.sortDir, copy.dirWords, copy.ascKeys);
  return (
    <div className={cx('control-field control-field-sort')}>
      <label className={cx('control-label')} htmlFor="sort-field">
        Sort by
      </label>
      <div className={cx('sort-pair')}>
        <Select.Root
          items={items}
          value={view.sortKey}
          onValueChange={(key) => {
            if (typeof key === 'string') update({ sortKey: key, sortDir: defaultDir(key, copy.ascKeys) });
          }}
        >
          <span className={cx('select-wrap')}>
            <Select.Trigger id="sort-field" className={cx('control-select')}>
              <Select.Value className={cx('select-value')} />
            </Select.Trigger>
          </span>
          <Select.Portal>
            <Select.Positioner className={cx('select-positioner')} sideOffset={4} alignItemWithTrigger={false}>
              <Select.Popup className={cx('select-popup')}>
                {copy.controls.sortGroups.map((g) => (
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
        <button
          type="button"
          id="sort-dir"
          className={cx('sort-dir')}
          data-dir={view.sortDir}
          aria-label={`Order: ${words.toLowerCase()}. Reverse the order`}
          onClick={() => update({ sortDir: view.sortDir === 'desc' ? 'asc' : 'desc' })}
        >
          <span className={cx('sort-dir-icon')} aria-hidden="true" />
          <span className={cx('sort-dir-label')} id="sort-dir-label">
            {words}
          </span>
        </button>
      </div>
    </div>
  );
}

function CopyLink({ show }: { show: boolean }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!show) {
      window.clearTimeout(timer.current);
      setState('idle');
    }
  }, [show]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setState('copied');
    } catch {
      setState('failed');
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 1800);
  };

  return (
    <button
      type="button"
      id="copy-link"
      className={cx('btn btn-ghost btn-sm copy-link')}
      hidden={!show}
      data-state={state === 'idle' ? undefined : state}
      onClick={copy}
    >
      {state === 'copied' ? 'Link copied' : state === 'failed' ? 'Copy from the address bar' : 'Copy link to this view'}
    </button>
  );
}

export function Controls() {
  const { config, view, update, clearFilters, visible, records } = useDirectory();
  const { copy, toggles, segments } = config;
  const { filtersOpen, toggleFilters } = useBoardUi();
  const hydrated = useHydrated();
  const count = resultText(visible.size, records.length, config.nouns);
  const active = view.toggles.length + view.segments.length;
  const chips = segments.filter((s) => s.chip !== null);
  const hasView =
    Boolean(view.q.trim()) ||
    active > 0 ||
    view.open !== null ||
    view.map !== null ||
    `${view.sortKey}-${view.sortDir}` !== 'community-desc';

  return (
    <div className={cx('controls')}>
      <div className={cx('control-row control-row-primary')}>
        <SearchField />
        <SortField />
      </div>

      <button
        type="button"
        className={cx('filter-disclosure')}
        id="filter-disclosure"
        aria-expanded={filtersOpen}
        aria-controls="filter-options"
        // No aria-label: its visible text ("Filters", then what is active) is the
        // name, and aria-expanded says whether the panel is open (WCAG 2.5.3).
        onClick={toggleFilters}
      >
        <FilterIcon />
        <span>Filters</span>
        <span className={cx('filter-disclosure-summary')} id="filter-disclosure-summary">
          {!hydrated
            ? copy.controls.filterSummary
            : active
              ? `${active} active · ${visible.size} results`
              : count}
        </span>
        <ChevronIcon className={cx('filter-disclosure-chevron')} />
      </button>

      <div className={cx(`control-row control-row-secondary${filtersOpen ? ' is-open' : ''}`)} id="filter-options">
        <fieldset className={cx('control-group control-group-wide')}>
          <legend className={cx('control-label')}>{copy.controls.togglesLegend}</legend>
          <CheckboxGroup
            className={cx('control-toggles')}
            value={view.toggles}
            onValueChange={(v) => update({ toggles: toggles.map((t) => t.key).filter((k) => v.includes(k)) })}
          >
            {toggles.map((t) => (
              <label key={t.key} className={cx('toggle')} title={t.title ?? undefined}>
                <Checkbox.Root
                  value={t.key}
                  id={`f-${t.key}`}
                  className={cx('toggle-input')}
                  aria-label={t.title ?? t.label}
                />
                <span className={cx('toggle-mark')} aria-hidden="true">
                  <Glyph name={t.icon} className={cx('toggle-icon')} size={15} />
                </span>
                <span className={cx('toggle-label')}>{t.label}</span>
              </label>
            ))}
          </CheckboxGroup>
        </fieldset>
        <div className={cx('control-group')}>
          <span className={cx('control-label')} id="model-chips-label">
            {copy.controls.chipsLabel}
          </span>
          <ToggleGroup
            multiple
            className={cx('control-chips')}
            id="model-chips"
            aria-labelledby="model-chips-label"
            value={view.segments}
            onValueChange={(v) => update({ segments: chips.map((c) => c.key).filter((k) => v.includes(k)) })}
          >
            {chips.map((s) => (
              <Toggle key={s.key} value={s.key} className={cx('chip')} data-model={s.key} aria-label={s.chipAria ?? undefined}>
                <TagIcon name={s.icon} />
                {s.chip}
              </Toggle>
            ))}
          </ToggleGroup>
        </div>
        <div className={cx('control-group control-group-end')}>
          <CopyLink show={hydrated && hasView} />
          <button type="button" id="clear-filters" className={cx('btn btn-ghost btn-sm')} onClick={clearFilters}>
            Clear filters
          </button>
          <p className={cx('result-count')} id="result-count" aria-live="polite">
            {count}
          </p>
        </div>
      </div>
    </div>
  );
}
