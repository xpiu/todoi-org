# todoi.org

A directory comparing browser-based task managers — [todoi.org](https://todoi.org) — rebuilt as a
server-rendered React application. Same URLs, same text, same behaviour, same design as the static
site it replaces.

> ## ⚠ Temporary: no PostgreSQL. The data is JSON in this repository.
>
> Since 2026-11-11 the site runs **without a database**. All of its data is one committed file,
> **`packages/db/seed/data.json`**, standing in for PostgreSQL until the database returns. It is
> bundled into the server at build time. **Sign-in and the editor at `/admin` are switched off**
> (they answer 404); a record changes by editing `data.json` and committing.
>
> This is a stopgap, not the design. The application was built on PostgreSQL 18 with a private
> editor, and goes back to it when features that need a database arrive: sign-in, the editor,
> configuration, social features. All of that code is parked, not deleted: still compiled, still
> tested when a database is at hand, and marked `TEMP(json-store)` wherever it was touched.
>
> **[docs/json-store.md](docs/json-store.md)** says what runs now, what is off, how to change a
> record, and the steps back to PostgreSQL. Below, a ⏸ marks what describes the parked design.

## Run it

Node and pnpm are pinned for [Volta](https://volta.sh) in `package.json`. No database is needed.

```sh
pnpm install
cp .env.example .env
pnpm dev                 # Hono + Vite, one port: http://localhost:3000
pnpm check               # typecheck, lint, unit tests
pnpm build && pnpm e2e   # Playwright, against the production build
```

⏸ Parked with PostgreSQL: `docker compose up -d` (PostgreSQL 18 on port **5434**; 5432 and 5433 are
left to anything else on the machine), `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:user`. They still
work against a database, and the site ignores it. The PostgreSQL tests run with
`TEST_DATABASE_URL=postgres://todoi:todoi@127.0.0.1:5434/todoi_test pnpm test`.

## Layout

```
apps/web        React 19: routes/, features/directory, features/admin, components/, styles/, public/
apps/server     Hono: public API, generated files (CSV, JSON-LD, sitemap, llms.txt); ⏸ editor API, sessions
packages/db     seed/data.json (all the data, for now) and the JSON store that reads it; ⏸ Drizzle schema, SQL migrations; the importer
packages/shared Zod schemas, the Score, view state, CSV
e2e/            Playwright suites and the visual-comparison tools
docs/           json-store.md: the temporary JSON store and the way back to PostgreSQL
```

**Stack.** TypeScript (strict) · Vite · React 19 server-rendered by Hono · TanStack Router (file
routes, Zod-typed search params) · TanStack Query (one `queryOptions` factory per resource) ·
Zustand (colour mode, filter panel) · Base UI · Zod at every boundary · ⏸ PostgreSQL 18 + Drizzle
(for now: `packages/db/seed/data.json`, read by `packages/db/src/json.ts`).
Types flow from the Drizzle schema to Zod to the Hono RPC client.

**Styling.** CSS Modules over global design tokens. `styles/global.css` holds the fonts, the light
and dark tokens (dark redefines the same ~30 names), the reset and base type; each component's rules
sit in its own `.module.css` beside it; `styles/late.css` holds buttons, utilities and print. Every
element keeps its plain hook class (`matrix-row`) beside its scoped one, through `cx()`, so tests,
scripts and other modules' `:global()` selectors can name it. `styles/modules.ts` fixes the cascade
order. No utility framework.

**Data.** `pnpm db:import` read the published pages and CSVs once (they carried hand edits the old
build scripts did not) and wrote `packages/db/seed/data.json`. The Score is never stored: the mean of
the six criteria and the band, rounded half up, defined once in `packages/shared`.

**Source map.** Every record says what is open and what is closed in four layers: `source.app`,
`source.server`, `source.extras` (paid editions and plugins) and `source.parts` (what the owner
publishes separately), each `{ level, label, note }` on the capability scale (2 open-source licence,
1 partly open or with conditions, 0 closed) or `null` when the product has no such layer. The label a
reader sees (FOSS, open core, source-available, mixed source, closed core, closed) is never stored:
`sourceClass()` in `packages/shared/src/source.ts` derives it, and the store refuses an open-source
record whose tag disagrees. Open core and closed core are mirror images: an open base with closed
extras, a closed base with open parts.

### `packages/db/seed/data.json`: the temporary replacement for PostgreSQL

Until PostgreSQL returns, this one file is the whole data store: the server reads it and nothing
else, and `pnpm db:seed` will be what loads it into the database on the way back.

```jsonc
{
  "directories": [
    { "slug": "open-source", "path": "/", "criteria": [...], "segments": [...], "records": [...] },  // 25 records
    { "slug": "commercial", "path": "/commercial-task-managers/", ...,           "records": [...] }   // 58 records
  ]
}
```

- **One entry per directory, each self-contained.** The two share a shape but no values (different
  criteria, capabilities, segments, copy and records), so nothing is factored out between them.
- **Order matters.** Directories, records, FAQs and routes are numbered in file order, exactly as
  PostgreSQL's serials number them when seeded: keep new directories at the end.
- **Checked at start.** The Zod schema (`SeedData` in `packages/db/src/seed-schema.ts`) and the
  database's constraints (`packages/db/src/json.ts`: unique slugs, known segments, criterion and
  capability keys, scores 1 to 5) run when the server starts; a bad edit stops it, naming the record.
- **To change a record**, edit the file, bump that directory's `modifiedOn`, run `pnpm test` (the
  CSV and JSON-LD fixtures are compared byte for byte), commit. `pnpm dev` restarts on save.

[docs/json-store.md](docs/json-store.md) has the rest: what is switched off, and the way back.

**Rendering.** Pages arrive as complete HTML and hydrate. Every record's detail is rendered on the
server into the matrix, so it is readable without JavaScript, but it is not shipped a second time as
hydration data (it is two thirds of the commercial page): the client keeps that HTML as an island and
fetches a record's detail only when a card opens it. Rendered pages are cached by URL until an editor
write invalidates them (for now: until the next deploy, since nothing writes).

**Editing.** ⏸ Parked: the editor is off and records change by commit ([docs/json-store.md](docs/json-store.md)).
As designed, and as it returns with PostgreSQL: every write names the row version it was read at; a stale write is a 409 carrying the
current row. In the editor every change goes through one optimistic helper
(`apps/web/src/features/admin/useOptimisticMutation.ts`): snapshot, apply, send, roll back and explain
on failure, invalidate when settled. Sessions are HttpOnly cookies stored only as a hash; writes need
a same-origin request and the session's CSRF token; sign-in is rate limited in the database.

## How it is checked

| Claim | Check |
|---|---|
| CSVs regenerated from the store match the published files | `apps/server/src/generate/csv.test.ts`, byte for byte |
| JSON-LD equivalent, `@id`s unchanged | `jsonld.test.ts`, node for node |
| Same text, order and filter results as the static site | `e2e/parity.spec.ts` (needs `STATIC_URL`): 21 views and every record's detail |
| Same design at phone, tablet and desktop, light and dark | `e2e/tools/visual-compare.mjs`: full-page screenshots of both sites, pixel-diffed — 0 differing pixels |
| Behaviour that must survive | `e2e/directory.spec.ts` |
| No WCAG 2.2 AA failures; keyboard reaches everything | `e2e/a11y.spec.ts` (axe), both modes and widths |
| Dark defines every token; text pairs reach AA | `apps/web/src/styles/tokens.test.ts` |
| ⏸ An edit shows at once, survives a reload, rolls back on failure | `e2e/admin.spec.ts` (skipped while the editor is parked) |
| `data.json` is well formed, in id order, and read the same by the store and the seeder | `packages/db/src/seed-schema.test.ts` |
| A licensing label is derived from the record's source map, and a label that disagrees stops the server | `packages/shared/src/source.test.ts`, `packages/db/src/seed-schema.test.ts` |
| No database: every record in `data.json` is served; sign-in, the editor and its API are 404 | `e2e/json-store.spec.ts` |
| ⏸ The JSON store equals a freshly seeded PostgreSQL, field for field | `packages/db/src/json.test.ts` (needs `TEST_DATABASE_URL`) |
| ⏸ Sign-in and editor writes, through the parked API | `apps/server/src/routes/admin.test.ts` (needs `TEST_DATABASE_URL`) |
| Lighthouse no worse than the static site | Median of three runs, mobile and desktop: equal or higher in every category on both pages |

## Deployment

A push to `main` that touches `todoi-org-react/` runs CI (`.github/workflows/react.yml` at the
repository root); only when it passes does the workflow call Dokploy's deploy webhook
(`DOKPLOY_DEPLOY_WEBHOOK`, a repository secret). Dokploy builds
`todoi-org-react/Dockerfile` (build context `todoi-org-react`): a multi-stage build whose runtime image holds the two bundles
(`data.json` is inside the server bundle), runs as `node` and reports health on `/healthz`.
Configure in Dokploy: `SITE_URL=https://todoi.org`. Nothing else: there is no database to attach, no
secret, and nothing to back up beyond the repository itself. Going live is attaching `todoi.org` to
this application; the static application stays available to switch back.

⏸ With PostgreSQL back ([docs/json-store.md](docs/json-store.md)): the image also holds the SQL
migrations and migrates before listening, `/healthz` pings the database, and Dokploy needs
`DATABASE_URL` (the managed PostgreSQL 18 on the internal network) and `SESSION_SECRET` (32+
characters). Backups: enable Dokploy's scheduled database backups to off-server storage and test one
restore before going live.

## Where this departs from the plan, and why

- **Record detail is not a Base UI Collapsible.** The detail is a server-rendered island so it can be
  in the HTML without being shipped twice; a Collapsible would re-render it. Open state is plain React.
- **The filter panel is not a Collapsible either.** It is always open at desktop width and collapses
  only below 640px, which a single `hidden` attribute cannot express; it stays a CSS-driven disclosure.
- **Method tooltips are one delegated tooltip, not a Base UI Tooltip per trigger.** Their triggers
  include the server-rendered islands, which React does not own; one shared, script-positioned node
  (as the static site had) serves several hundred triggers.
- **Capability screen-reader lines** end with one consistent full stop; the static pages varied.
- **The phone filter disclosure** has no `aria-label`: the static one failed WCAG 2.5.3.
- **llms.txt** quotes the Score the page shows for commercial products; the published file still
  carried six-criterion means from an older build.
- **Icons below the first screenful load lazily by position in the current order**, not by their
  original position, so a re-sorted list loads the icons that are actually on screen.
