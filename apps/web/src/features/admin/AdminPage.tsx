import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Dialog } from '@base-ui/react/dialog';
import { Field } from '@base-ui/react/field';
import { Form } from '@base-ui/react/form';
import { Input } from '@base-ui/react/input';
import { Select } from '@base-ui/react/select';
import {
  bandLabel,
  BAND_LABELS,
  computeScore,
  formatScore,
  type AdminDirectory,
  type AdminRecord,
  type Level,
} from '@todoi/shared';
import { WordmarkLogo } from '../../components/icons.tsx';
import { ThemeSwitch } from '../../components/ThemeSwitch.tsx';
import { HttpError } from '../../lib/api.ts';
import { adminApi, adminDirectoryQuery, adminKeys, directoriesQuery, sessionQuery, type Session } from './api.ts';
import { ToastHost, useToasts } from './toasts.tsx';
import { useOptimisticMutation } from './useOptimisticMutation.ts';
import '../../styles/admin.css';
import { cx } from '../../styles/modules.ts';

const LEVELS: { value: Level; label: string }[] = [
  { value: 2, label: 'Native' },
  { value: 1, label: 'Partial' },
  { value: 0, label: 'Not native' },
];
const CONFIDENCE = ['High', 'Medium-high', 'Medium'] as const;

const scoreOf = (dir: AdminDirectory, r: AdminRecord) =>
  computeScore(
    dir.directory.criteria.map((c) => r.scores[c.key]?.score ?? 0),
    r.band,
  );

export function AdminPage() {
  return (
    <ToastHost>
      <AdminShell />
    </ToastHost>
  );
}

function AdminShell() {
  const session = useQuery(sessionQuery);
  return (
    <>
      <header className={cx('site-header')}>
        <div className={cx('shell site-header-inner')}>
          <span className={cx('admin-brand')}>
            <a className={cx('wordmark')} href="/" aria-label="todoi.org, home">
              <WordmarkLogo />
              <span className={cx('wordmark-name')}>
                todoi<span className={cx('wordmark-tld')}>.org</span>
              </span>
            </a>
            <span className={cx('admin-badge')}>Editor</span>
          </span>
          {session.data ? <SignOut session={session.data} /> : null}
          <ThemeSwitch />
        </div>
      </header>
      <main id="main" className={cx('admin shell')}>
        {session.isPending ? (
          <p className={cx('admin-note')} aria-busy="true">
            Checking your session…
          </p>
        ) : session.data ? (
          <Editor session={session.data} />
        ) : (
          <SignIn />
        )}
      </main>
    </>
  );
}

/* --- Sign in: not optimistic, it waits for the server ------------------- */

function SignIn() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const login = useMutation({
    mutationFn: adminApi.login,
    onSuccess: (session) => queryClient.setQueryData(adminKeys.session, session),
    onError: (err) => setError(err instanceof HttpError ? err.message : 'The server could not be reached.'),
  });
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setError(null);
    login.mutate({ email: String(data.get('email')), password: String(data.get('password')) });
  };
  return (
    <section className={cx('admin-signin')} aria-labelledby="signin-title">
      <h1 className={cx('admin-title')} id="signin-title">
        Sign in to edit
      </h1>
      <p className={cx('admin-note')}>The directory is public; changing it is not. Editors sign in with the address they were given.</p>
      <Form className={cx('admin-form')} onSubmit={submit}>
        <Field.Root name="email" className={cx('admin-field')}>
          <Field.Label className={cx('control-label')}>E-mail</Field.Label>
          <Input type="email" name="email" required autoComplete="username" className={cx('control-search admin-input')} />
        </Field.Root>
        <Field.Root name="password" className={cx('admin-field')}>
          <Field.Label className={cx('control-label')}>Password</Field.Label>
          <Input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className={cx('control-search admin-input')}
          />
        </Field.Root>
        {error ? (
          <p className={cx('admin-error')} role="alert">
            {error}
          </p>
        ) : null}
        <p>
          <button type="submit" className={cx('btn btn-primary')} disabled={login.isPending}>
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </button>
        </p>
      </Form>
    </section>
  );
}

function SignOut({ session }: { session: Session }) {
  const queryClient = useQueryClient();
  const logout = useMutation({
    mutationFn: () => adminApi.logout(session),
    onSettled: () => queryClient.setQueryData(adminKeys.session, null),
  });
  return (
    <span className={cx('admin-who')}>
      <span className={cx('admin-email')}>{session.email}</span>
      <button type="button" className={cx('btn btn-ghost btn-sm')} onClick={() => logout.mutate()}>
        Sign out
      </button>
    </span>
  );
}

/* --- The editor ------------------------------------------------------- */

function Editor({ session }: { session: Session }) {
  const search = useSearch({ from: '/admin' });
  const navigate = useNavigate({ from: '/admin' });
  const dirs = useQuery(directoriesQuery);
  const slug = search.dir ?? dirs.data?.[0]?.slug;
  const dir = useQuery({ ...adminDirectoryQuery(slug ?? ''), enabled: Boolean(slug) });
  const [filter, setFilter] = useState('');

  const records = useMemo(() => {
    if (!dir.data) return [];
    const t = filter.trim().toLowerCase();
    return dir.data.records
      .filter((r) => !t || r.name.toLowerCase().includes(t) || r.slug.includes(t))
      .map((r) => ({ r, score: scoreOf(dir.data, r) }))
      .sort((a, b) => b.score - a.score || a.r.name.localeCompare(b.r.name));
  }, [dir.data, filter]);

  const selected = dir.data?.records.find((r) => r.slug === search.record) ?? null;

  if (dirs.isError || dir.isError) {
    return (
      <p className={cx('admin-error')} role="alert">
        The editor could not load its data. Reload the page; if it persists, sign out and in again.
      </p>
    );
  }
  if (!dir.data || !slug) {
    return (
      <p className={cx('admin-note')} aria-busy="true">
        Loading…
      </p>
    );
  }

  return (
    <>
      <div className={cx('admin-head')}>
        <h1 className={cx('admin-title')}>Editor</h1>
        <nav className={cx('admin-dirs')} aria-label="Directories">
          {dirs.data?.map((d) => (
            <button
              key={d.slug}
              type="button"
              className={cx('chip')}
              aria-pressed={d.slug === slug}
              onClick={() => void navigate({ search: { dir: d.slug } })}
            >
              {d.title}
            </button>
          ))}
        </nav>
        <a className={cx('btn btn-ghost btn-sm')} href={dir.data.directory.path} target="_blank" rel="noopener">
          View the page
        </a>
      </div>

      <div className={cx('admin-grid')}>
        <aside className={cx('admin-list')} aria-label="Records">
          <div className={cx('admin-list-head')}>
            <input
              type="search"
              className={cx('control-search admin-input')}
              placeholder="Find a record"
              aria-label="Find a record"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <NewRecord session={session} dir={dir.data} />
          </div>
          <ol className={cx('admin-records')} aria-label="Records by Score, highest first">
            {records.map(({ r, score }) => (
              <li key={r.slug}>
                <button
                  type="button"
                  className={cx('admin-record')}
                  aria-current={r.slug === selected?.slug ? 'true' : undefined}
                  data-slug={r.slug}
                  onClick={() => void navigate({ search: { dir: slug, record: r.slug } })}
                >
                  <span className={cx('admin-record-name')}>{r.name}</span>
                  <span className={cx('admin-record-score')} data-score-value={formatScore(score)}>
                    {formatScore(score)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </aside>

        <section className={cx('admin-panel')} aria-label="Edit record">
          {selected ? (
            <RecordEditor
              // Remount on the values shown: a rolled-back save resets the fields too.
              key={`${selected.slug}:${selected.version}:${JSON.stringify([selected.name, selected.url, selected.blurb, selected.year, selected.band, selected.integrationsLabel, selected.integrations, selected.confidence, selected.caveat, selected.summary])}`}
              session={session}
              dir={dir.data}
              record={selected}
            />
          ) : (
            <p className={cx('admin-note')}>Choose a record to edit its scores, capabilities and facts.</p>
          )}
        </section>
      </div>

      <Faqs session={session} dir={dir.data} />
    </>
  );
}

/* --- One record ------------------------------------------------------- */

function updateRecord(cache: AdminDirectory, slug: string, fn: (r: AdminRecord) => AdminRecord): AdminDirectory {
  return { ...cache, records: cache.records.map((r) => (r.slug === slug ? fn(r) : r)) };
}

function RecordEditor({ session, dir, record }: { session: Session; dir: AdminDirectory; record: AdminRecord }) {
  const slug = dir.directory.slug;
  const queryKey = adminKeys.directory(slug);
  const score = scoreOf(dir, record);

  const patch = useOptimisticMutation<AdminDirectory, Parameters<typeof adminApi.patchRecord>[3], { version: number }>({
    queryKey,
    directory: slug,
    mutationFn: (vars) => adminApi.patchRecord(session, slug, record.slug, vars),
    apply: (cache, { version: _v, ...fields }) => updateRecord(cache, record.slug, (r) => ({ ...r, ...fields })),
    reconcile: (cache, res) => updateRecord(cache, record.slug, (r) => ({ ...r, version: res.version })),
    describe: () => `${record.name}: record`,
    describeConflict: (current) =>
      `Their version: “${String((current as { caveat?: string } | null)?.caveat ?? '').slice(0, 120)}”`,
  });

  const [form, setForm] = useState(() => ({
    name: record.name,
    url: record.url,
    blurb: record.blurb,
    year: String(record.year),
    band: String(record.band),
    integrationsLabel: record.integrationsLabel,
    integrations: String(record.integrations),
    confidence: record.confidence,
    caveat: record.caveat,
    summary: record.summary.join('\n\n'),
  }));
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = (e: FormEvent) => {
    e.preventDefault();
    patch.mutate({
      version: record.version,
      name: form.name.trim(),
      url: form.url.trim(),
      blurb: form.blurb.trim(),
      year: Number(form.year),
      band: Number(form.band),
      integrationsLabel: form.integrationsLabel.trim(),
      integrations: Number(form.integrations),
      confidence: form.confidence,
      caveat: form.caveat.trim(),
      summary: form.summary
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean),
    });
  };

  return (
    <div className={cx('admin-editor')}>
      <div className={cx('admin-editor-head')}>
        <h2 className={cx('section-title')}>{record.name}</h2>
        <p className={cx('admin-score')} aria-live="polite">
          Score <strong>{formatScore(score)}</strong>
          <span className={cx('admin-note')}> · mean of the six criteria and the band</span>
        </p>
        <DeleteRecord session={session} dir={dir} record={record} />
      </div>

      <Form className={cx('admin-form admin-card')} onSubmit={save} aria-label="Record">
        <h3 className={cx('sub-title')}>Record</h3>
        <div className={cx('admin-fields')}>
          <TextField label="Name" value={form.name} onChange={set('name')} required />
          <TextField label="Website" value={form.url} onChange={set('url')} type="url" required />
          <TextField label="First appeared" value={form.year} onChange={set('year')} type="number" required />
          <PickField
            label={dir.directory.copy.band.name}
            value={form.band}
            onChange={set('band')}
            items={BAND_LABELS.map((l, i) => ({ value: String(i + 1), label: `${i + 1} · ${l}` }))}
          />
          <TextField label="Integrations (shown)" value={form.integrationsLabel} onChange={set('integrationsLabel')} required />
          <TextField label="Integrations (sorts by)" value={form.integrations} onChange={set('integrations')} type="number" required />
          <PickField
            label="Confidence"
            value={form.confidence}
            onChange={(v) => set('confidence')(v)}
            items={CONFIDENCE.map((c) => ({ value: c, label: c }))}
          />
        </div>
        <TextField label="One-line description" value={form.blurb} onChange={set('blurb')} multiline required />
        <TextField label="Caveat" value={form.caveat} onChange={set('caveat')} multiline required />
        <TextField
          label="Summary (paragraphs separated by a blank line)"
          value={form.summary}
          onChange={set('summary')}
          multiline
          rows={10}
          required
        />
        <p>
          <button type="submit" className={cx('btn btn-primary btn-sm')}>
            Save record
          </button>
        </p>
      </Form>

      <div className={cx('admin-card')}>
        <h3 className={cx('sub-title')}>Scores</h3>
        <p className={cx('admin-note')}>
          {dir.directory.copy.band.name}: {bandLabel(record.band)} ({record.band}.0), set above.
        </p>
        {dir.directory.criteria.map((c) => (
          <ScoreEditor
            key={`${c.key}:${record.scores[c.key]?.version}:${record.scores[c.key]?.score}:${record.scores[c.key]?.review}`}
            session={session}
            dir={dir}
            record={record}
            criterion={c.key}
            name={c.name}
          />
        ))}
      </div>

      <div className={cx('admin-card')}>
        <h3 className={cx('sub-title')}>Capabilities</h3>
        {dir.directory.capabilities.map((c) => (
          <CapabilityEditor
            key={`${c.key}:${record.caps[c.key]?.version}:${record.caps[c.key]?.level}:${record.caps[c.key]?.note}`}
            session={session}
            dir={dir}
            record={record}
            capability={c.key}
            name={c.sr}
          />
        ))}
      </div>
    </div>
  );
}

function ScoreEditor(props: { session: Session; dir: AdminDirectory; record: AdminRecord; criterion: string; name: string }) {
  const { session, dir, record, criterion, name } = props;
  const slug = dir.directory.slug;
  const row = record.scores[criterion]!;
  const [value, setValue] = useState(formatScore(row.score));
  const [review, setReview] = useState(row.review);
  const put = useOptimisticMutation<AdminDirectory, { version: number; score: number; review: string }, { score: number; review: string; version: number }>({
    queryKey: adminKeys.directory(slug),
    directory: slug,
    mutationFn: (vars) => adminApi.putScore(session, slug, record.slug, criterion, vars),
    apply: (cache, vars) =>
      updateRecord(cache, record.slug, (r) => ({
        ...r,
        scores: { ...r.scores, [criterion]: { score: vars.score, review: vars.review, version: r.scores[criterion]!.version } },
      })),
    reconcile: (cache, res) =>
      updateRecord(cache, record.slug, (r) => ({ ...r, scores: { ...r.scores, [criterion]: res } })),
    describe: () => `${record.name}: ${name}`,
    describeConflict: (current) => {
      const c = current as { score?: number; review?: string } | null;
      return c ? `Their score: ${formatScore(c.score ?? 0)}, “${(c.review ?? '').slice(0, 100)}”` : '';
    },
  });
  return (
    <form
      className={cx('admin-row')}
      aria-label={name}
      data-criterion={criterion}
      onSubmit={(e) => {
        e.preventDefault();
        put.mutate({ version: row.version, score: Math.round(Number(value) * 10) / 10, review: review.trim() });
      }}
    >
      <label className={cx('admin-row-label')}>
        <span className={cx('control-label')}>{name}</span>
        <input
          className={cx('control-search admin-input admin-num')}
          type="number"
          min={1}
          max={5}
          step={0.1}
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          name="score"
        />
      </label>
      <label className={cx('admin-row-text')}>
        <span className={cx('sr-only')}>Reasoning for {name}</span>
        <textarea
          className={cx('control-search admin-input admin-textarea')}
          rows={2}
          required
          value={review}
          onChange={(e) => setReview(e.target.value)}
          name="review"
        />
      </label>
      <button type="submit" className={cx('btn btn-ghost btn-sm')}>
        Save
      </button>
    </form>
  );
}

function CapabilityEditor(props: { session: Session; dir: AdminDirectory; record: AdminRecord; capability: string; name: string }) {
  const { session, dir, record, capability, name } = props;
  const slug = dir.directory.slug;
  const row = record.caps[capability]!;
  const [level, setLevel] = useState<string>(String(row.level));
  const [note, setNote] = useState(row.note ?? '');
  const put = useOptimisticMutation<AdminDirectory, { version: number; level: Level; note: string | null }, { level: Level; note: string | null; version: number }>({
    queryKey: adminKeys.directory(slug),
    directory: slug,
    mutationFn: (vars) => adminApi.putCapability(session, slug, record.slug, capability, vars),
    apply: (cache, vars) =>
      updateRecord(cache, record.slug, (r) => ({
        ...r,
        caps: { ...r.caps, [capability]: { level: vars.level, note: vars.note, version: r.caps[capability]!.version } },
      })),
    reconcile: (cache, res) => updateRecord(cache, record.slug, (r) => ({ ...r, caps: { ...r.caps, [capability]: res } })),
    describe: () => `${record.name}: ${name}`,
  });
  return (
    <form
      className={cx('admin-row')}
      aria-label={name}
      data-capability={capability}
      onSubmit={(e) => {
        e.preventDefault();
        put.mutate({ version: row.version, level: Number(level) as Level, note: note.trim() || null });
      }}
    >
      <div className={cx('admin-row-label')}>
        <PickField label={name} value={level} onChange={setLevel} items={LEVELS.map((l) => ({ value: String(l.value), label: l.label }))} />
      </div>
      <label className={cx('admin-row-text')}>
        <span className={cx('sr-only')}>Note on {name}</span>
        <input
          className={cx('control-search admin-input')}
          placeholder="Note, when partial or missing"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          name="note"
        />
      </label>
      <button type="submit" className={cx('btn btn-ghost btn-sm')}>
        Save
      </button>
    </form>
  );
}

/* --- Create and delete: they wait for the server ------------------------- */

function NewRecord({ session, dir }: { session: Session; dir: AdminDirectory }) {
  const slug = dir.directory.slug;
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: '/admin' });
  const toast = useToasts();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const segments = dir.directory.segments.filter((s) => s.chip !== null);
  const [model, setModel] = useState(segments[0]?.key ?? '');
  const create = useMutation({
    mutationFn: (json: Parameters<typeof adminApi.createRecord>[2]) => adminApi.createRecord(session, slug, json),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.directory(slug) });
      setOpen(false);
      toast.add({ title: 'Record created', description: res.slug, type: 'success' });
      void navigate({ search: { dir: slug, record: res.slug } });
    },
    onError: (err) => setError(err instanceof HttpError ? err.message : 'The server could not be reached.'),
  });
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className={cx('btn btn-primary btn-sm')}>New record</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className={cx('dialog-backdrop')} />
        <Dialog.Popup className={cx('dialog')}>
          <Dialog.Title className={cx('section-title')}>New record</Dialog.Title>
          <Dialog.Description className={cx('admin-note')}>
            It starts as a first pass: every criterion at 3.0 awaiting its reasoning, Medium confidence.
          </Dialog.Description>
          <Form
            className={cx('admin-form')}
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              setError(null);
              create.mutate({
                slug: String(d.get('slug')).trim(),
                name: String(d.get('name')).trim(),
                url: String(d.get('url')).trim(),
                blurb: String(d.get('blurb')).trim(),
                model,
                year: Number(d.get('year')),
              });
            }}
          >
            <TextField label="Name" name="name" required />
            <TextField label="Slug (lower case, hyphens)" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" />
            <TextField label="Website" name="url" type="url" required />
            <TextField label="First appeared" name="year" type="number" required />
            <PickField
              label={dir.directory.copy.controls.chipsLabel}
              value={model}
              onChange={setModel}
              items={segments.map((s) => ({ value: s.key, label: s.label }))}
            />
            <TextField label="One-line description" name="blurb" multiline required />
            {error ? (
              <p className={cx('admin-error')} role="alert">
                {error}
              </p>
            ) : null}
            <p className={cx('dialog-actions')}>
              <Dialog.Close className={cx('btn btn-ghost btn-sm')}>Cancel</Dialog.Close>
              <button type="submit" className={cx('btn btn-primary btn-sm')} disabled={create.isPending}>
                {create.isPending ? 'Creating…' : 'Create'}
              </button>
            </p>
          </Form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DeleteRecord({ session, dir, record }: { session: Session; dir: AdminDirectory; record: AdminRecord }) {
  const slug = dir.directory.slug;
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: '/admin' });
  const toast = useToasts();
  const [open, setOpen] = useState(false);
  const del = useMutation({
    mutationFn: () => adminApi.deleteRecord(session, slug, record.slug),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.directory(slug) });
      setOpen(false);
      toast.add({ title: 'Record deleted', description: record.name, type: 'success' });
      void navigate({ search: { dir: slug } });
    },
    onError: (err) =>
      toast.add({ title: 'Not deleted', description: err instanceof HttpError ? err.message : 'The server could not be reached.', type: 'error' }),
  });
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className={cx('btn btn-ghost btn-sm admin-danger')}>Delete…</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className={cx('dialog-backdrop')} />
        <Dialog.Popup className={cx('dialog')}>
          <Dialog.Title className={cx('section-title')}>Delete {record.name}?</Dialog.Title>
          <Dialog.Description className={cx('admin-note')}>
            The record, its scores, capabilities and sources leave the page and the dataset. This cannot be undone.
          </Dialog.Description>
          <p className={cx('dialog-actions')}>
            <Dialog.Close className={cx('btn btn-ghost btn-sm')}>Keep it</Dialog.Close>
            <button type="button" className={cx('btn btn-primary btn-sm admin-danger-solid')} onClick={() => del.mutate()} disabled={del.isPending}>
              {del.isPending ? 'Deleting…' : 'Delete'}
            </button>
          </p>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* --- FAQ ----------------------------------------------------------------- */

function Faqs({ session, dir }: { session: Session; dir: AdminDirectory }) {
  return (
    <section className={cx('admin-card admin-faqs')} aria-labelledby="faqs-title">
      <h2 className={cx('section-title')} id="faqs-title">
        Questions
      </h2>
      <p className={cx('admin-note')}>Answers take inline HTML: paragraphs, bold, italics and links. Anything else is removed.</p>
      {dir.directory.faqs.map((f) => (
        <FaqEditor key={`${f.id}:${f.version}:${f.question}:${f.answer}`} session={session} dir={dir} faq={f} />
      ))}
    </section>
  );
}

function FaqEditor({ session, dir, faq }: { session: Session; dir: AdminDirectory; faq: AdminDirectory['directory']['faqs'][number] }) {
  const slug = dir.directory.slug;
  const [question, setQuestion] = useState(faq.question);
  const [answer, setAnswer] = useState<string>(faq.answer);
  const put = useOptimisticMutation<AdminDirectory, { version: number; question: string; answer: string }, { id: number; question: string; answer: string; version: number }>({
    queryKey: adminKeys.directory(slug),
    directory: slug,
    mutationFn: (vars) => adminApi.putFaq(session, slug, faq.id, vars),
    apply: (cache, vars) => ({
      ...cache,
      directory: {
        ...cache.directory,
        faqs: cache.directory.faqs.map((f) => (f.id === faq.id ? { ...f, question: vars.question, answer: vars.answer as never } : f)),
      },
    }),
    reconcile: (cache, res) => ({
      ...cache,
      directory: { ...cache.directory, faqs: cache.directory.faqs.map((f) => (f.id === faq.id ? { ...f, ...res, answer: res.answer as never } : f)) },
    }),
    describe: () => `Question: ${faq.question}`,
  });
  return (
    <form
      className={cx('admin-faq')}
      aria-label={faq.question}
      onSubmit={(e) => {
        e.preventDefault();
        put.mutate({ version: faq.version, question: question.trim(), answer: answer.trim() });
      }}
    >
      <TextField label="Question" value={question} onChange={setQuestion} required />
      <TextField label="Answer" value={answer} onChange={setAnswer} multiline rows={4} required />
      <p>
        <button type="submit" className={cx('btn btn-ghost btn-sm')}>
          Save question
        </button>
      </p>
    </form>
  );
}

/* --- Fields -------------------------------------------------------------- */

function TextField(props: {
  label: string;
  value?: string;
  onChange?: (v: string) => void;
  name?: string;
  type?: string;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  pattern?: string;
}) {
  const controlled = props.value !== undefined ? { value: props.value, onChange: (e: { target: { value: string } }) => props.onChange?.(e.target.value) } : {};
  return (
    <Field.Root className={cx('admin-field')} name={props.name}>
      <Field.Label className={cx('control-label')}>{props.label}</Field.Label>
      {props.multiline ? (
        <Field.Control
          render={<textarea rows={props.rows ?? 3} />}
          className={cx('control-search admin-input admin-textarea')}
          required={props.required}
          name={props.name}
          {...controlled}
        />
      ) : (
        <Field.Control
          className={cx('control-search admin-input')}
          type={props.type ?? 'text'}
          required={props.required}
          name={props.name}
          pattern={props.pattern}
          {...controlled}
        />
      )}
      <Field.Error className={cx('admin-error')} />
    </Field.Root>
  );
}

function PickField(props: { label: string; value: string; onChange: (v: string) => void; items: { value: string; label: string }[] }) {
  return (
    <Field.Root className={cx('admin-field')}>
      <Field.Label className={cx('control-label')} nativeLabel={false} render={<div />}>
        {props.label}
      </Field.Label>
      <Select.Root items={props.items} value={props.value} onValueChange={(v) => typeof v === 'string' && props.onChange(v)}>
        <span className={cx('select-wrap')}>
          <Select.Trigger className={cx('control-select')} aria-label={props.label}>
            <Select.Value className={cx('select-value')} />
          </Select.Trigger>
        </span>
        <Select.Portal>
          <Select.Positioner className={cx('select-positioner')} sideOffset={4} alignItemWithTrigger={false}>
            <Select.Popup className={cx('select-popup')}>
              {props.items.map((i) => (
                <Select.Item key={i.value} value={i.value} className={cx('select-item')}>
                  <Select.ItemText>{i.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </Field.Root>
  );
}
