# todoi.org

A directory comparing browser-based task managers — [todoi.org](https://todoi.org) — rebuilt as a
server-rendered, database-backed React application. Same URLs, same text, same behaviour, same
design as the static site it replaces; the records now live in PostgreSQL and change through a
private editor at `/admin`.

## Run it

Node and pnpm are pinned for [Volta](https://volta.sh) in `package.json`. PostgreSQL 18 runs in
Docker Compose on port **5434** (5432 and 5433 are left to anything else on the machine).

```sh
pnpm install
cp .env.example .env
docker compose up -d     # PostgreSQL
pnpm db:migrate
pnpm db:seed             # --reset to replace the directory data
pnpm dev                 # Hono + Vite, one port: http://localhost:3000
pnpm check               # typecheck, lint, unit and integration tests
pnpm build && pnpm e2e   # Playwright, against the production build and a reset test database
```

An editor account: `EDITOR_PASSWORD='…' pnpm db:user someone@example.org`, then sign in at `/admin`.

## Layout

```
apps/web        React 19: routes/, features/directory, features/admin, components/, styles/, public/
apps/server     Hono: public and editor API, sessions, generated files (CSV, JSON-LD, sitemap, llms.txt)
packages/db     Drizzle schema, SQL migrations, the importer, the committed seed
packages/shared Zod schemas, the Score, view state, CSV
e2e/            Playwright suites and the visual-comparison tools
```

**Stack.** TypeScript (strict) · Vite · React 19 server-rendered by Hono · TanStack Router (file
routes, Zod-typed search params) · TanStack Query (one `queryOptions` factory per resource) ·
Zustand (colour mode, filter panel) · Base UI · Zod at every boundary · PostgreSQL 18 + Drizzle.
Types flow from the Drizzle schema to Zod to the Hono RPC client.

**Styling.** CSS Modules over global design tokens. `styles/global.css` holds the fonts, the light
and dark tokens (dark redefines the same ~30 names), the reset and base type; each component's rules
sit in its own `.module.css` beside it; `styles/late.css` holds buttons, utilities and print. Every
element keeps its plain hook class (`matrix-row`) beside its scoped one, through `cx()`, so tests,
scripts and other modules' `:global()` selectors can name it. `styles/modules.ts` fixes the cascade
order. No utility framework.

**Data.** `pnpm db:import` read the published pages and CSVs once (they carried hand edits the old
build scripts did not) and wrote `packages/db/seed/*.json`. The Score is never stored: the mean of
the six criteria and the band, rounded half up, defined once in `packages/shared`.

**Rendering.** Pages arrive as complete HTML and hydrate. Every record's detail is rendered on the
server into the matrix, so it is readable without JavaScript, but it is not shipped a second time as
hydration data (it is two thirds of the commercial page): the client keeps that HTML as an island and
fetches a record's detail only when a card opens it. Rendered pages are cached by URL until an editor
write invalidates them.

**Editing.** Every write names the row version it was read at; a stale write is a 409 carrying the
current row. In the editor every change goes through one optimistic helper
(`apps/web/src/features/admin/useOptimisticMutation.ts`): snapshot, apply, send, roll back and explain
on failure, invalidate when settled. Sessions are HttpOnly cookies stored only as a hash; writes need
a same-origin request and the session's CSRF token; sign-in is rate limited in the database.

## How it is checked

| Claim | Check |
|---|---|
| CSVs regenerated from the database match the published files | `apps/server/src/generate/csv.test.ts`, byte for byte |
| JSON-LD equivalent, `@id`s unchanged | `jsonld.test.ts`, node for node |
| Same text, order and filter results as the static site | `e2e/parity.spec.ts` (needs `STATIC_URL`): 21 views and every record's detail |
| Same design at phone, tablet and desktop, light and dark | `e2e/tools/visual-compare.mjs`: full-page screenshots of both sites, pixel-diffed — 0 differing pixels |
| Behaviour that must survive | `e2e/directory.spec.ts` |
| No WCAG 2.2 AA failures; keyboard reaches everything | `e2e/a11y.spec.ts` (axe), both modes and widths |
| Dark defines every token; text pairs reach AA | `apps/web/src/styles/tokens.test.ts` |
| An edit shows at once, survives a reload, rolls back on failure | `e2e/admin.spec.ts` |
| Lighthouse no worse than the static site | Median of three runs, mobile and desktop: equal or higher in every category on both pages |

## Deployment

A push to `main` that touches `todoi-org-react/` runs CI (`.github/workflows/react.yml` at the
repository root); only when it passes does the workflow call Dokploy's deploy webhook
(`DOKPLOY_DEPLOY_WEBHOOK`, a repository secret). Dokploy builds
`todoi-org-react/Dockerfile` (build context `todoi-org-react`): a multi-stage build whose runtime image holds the two bundles and the SQL migrations,
runs as `node`, migrates before listening and reports health on `/healthz` (which pings the
database). Configure in Dokploy: `DATABASE_URL` (the managed PostgreSQL 18 on the internal network),
`SESSION_SECRET` (32+ characters), `SITE_URL=https://todoi.org`. Backups: enable Dokploy's scheduled
database backups to off-server storage and test one restore before going live. Going live is
attaching `todoi.org` to this application; the static application stays available to switch back.

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
