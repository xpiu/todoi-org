# Temporary: the site runs on JSON, not PostgreSQL

**Status: in force since 2026-11-11. Temporary. The site was not live when this was done.**

The application was built on PostgreSQL 18 (Drizzle) with a private editor at `/admin`. For now it
runs **without any database**: the directory data is the two committed seed files, and sign-in and
the editor are switched off. PostgreSQL comes back when features that need it do: sign-in, the
editor, configuration, social features, anything that writes at run time.

Nothing was deleted. The PostgreSQL code is parked: unmounted, still compiled, still tested when a
database is available. Every place that was touched carries the same tag, so this finds all of it:

```sh
grep -rn "TEMP(json-store)" . --exclude-dir=node_modules --exclude-dir=dist   # from todoi-org-react/
grep -n  "TEMP(json-store)" ../.github/workflows/react.yml
```

## What runs now

| | |
|---|---|
| The data | `packages/db/seed/open-source.json` and `packages/db/seed/commercial.json` |
| The store | `packages/db/src/json.ts` turns them into the same objects `loadFullDirectory` returned from the database |
| Wiring | `apps/server/src/sources/json.ts`, given to `DirectoryStore` in `apps/server/src/index.ts` and `dev.ts` |
| Build | `pnpm build` bundles the seed into `apps/server/dist/index.js`; `pg` and Drizzle are not in the bundle |
| Environment | `PORT`, `HOST`, `SITE_URL`, `NODE_ENV`, `TRUST_PROXY`. `DATABASE_URL` and `SESSION_SECRET` are not read |
| Health | `/healthz` answers `{ ok: true, data: "seed-json", directories: 2 }` |

Pages, the public API (`/api/v1/directories/…`), the CSVs, JSON-LD, `sitemap.xml` and `llms.txt` are
unchanged: they read the store, and the store returns what it always did.

## Changing a record

Edit the seed file, bump `modifiedOn` at the top of that file to today (the sitemap's `lastmod` and
the JSON-LD `dateModified` follow it; the editor used to do this on every write), commit, deploy.
`pnpm dev` restarts when a seed file is saved.

The seed is checked when the server starts, and a bad one stops it with a message naming the
record: the Zod schema in `packages/db/src/seed-schema.ts`, plus the constraints the database
enforced (unique slugs, a known segment, known criterion and capability keys, scores from 1 to 5).
Two things the editor did that a hand edit does not:

- **HTML is not sanitised.** FAQ answers and the other inline-HTML fields went through an
  allow-list on write. A seed file is trusted as committed: keep to `<strong>`, `<em>`, `<a href>`,
  `<time>`.
- **The published CSV fixtures are compared byte for byte** (`apps/server/src/generate/csv.test.ts`,
  also JSON-LD and `llms.txt`). A data edit that changes them fails `pnpm test` until the fixture in
  `apps/server/test/fixtures/` is updated on purpose.

## What is switched off

| Off | Where | Now answers |
|---|---|---|
| The editor page `/admin` | `EDITOR_ENABLED` in `apps/web/src/routes/admin.tsx` | the 404 page, status 404; the editor's script is never loaded |
| Sign-in `/api/v1/auth/*` | not mounted: `apps/server/src/editor-api.ts` | 404, JSON |
| Editor API `/api/v1/admin/*` (every write) | not mounted: same file | 404, JSON |
| Database connection, migrations on start | commented out in `apps/server/src/index.ts`, `dev.ts` | |
| `DATABASE_URL`, `SESSION_SECRET` | commented out in `apps/server/src/env.ts`, `.env.example` | ignored if set |
| Migrations in the image | commented out in `Dockerfile` | |
| PostgreSQL in CI | commented out in `../.github/workflows/react.yml` | |
| Test database for e2e | commented out in `e2e/tools/serve-test.mjs` | |
| Editor e2e tests | `test.skip` at the top of `e2e/admin.spec.ts` | reported as skipped |
| PostgreSQL integration tests | left out by `vitest.config.ts` unless `TEST_DATABASE_URL` is set | |

## What is parked (kept, compiled, not running)

- `packages/db`: `schema.ts`, `migrations/`, `queries.ts`, `mutations.ts`, `seed.ts`, `password.ts`,
  the `pnpm db:*` scripts. `pg` and `drizzle-orm` stay in `package.json` for these; they are
  installed, typechecked, and not bundled.
- `apps/server`: `editor-api.ts`, `auth.ts`, `routes/auth.ts`, `routes/admin.ts`,
  `sources/postgres.ts`, `test/db.ts`.
- `apps/web`: `features/admin/` (the editor) and its styles.
- `compose.yaml`: local PostgreSQL, for the parked tests and scripts only.

Two tests keep the parked code honest. They need PostgreSQL, so they run only when asked:

```sh
docker compose up -d
TEST_DATABASE_URL=postgres://todoi:todoi@127.0.0.1:5434/todoi_test pnpm test
```

- `packages/db/src/json.test.ts`: the JSON store equals a freshly seeded database, field for field.
- `apps/server/src/routes/admin.test.ts`: sign-in and every editor write, through the parked API
  mounted the way it will be when it returns.

## Going back to PostgreSQL

The seed files stay the source until the switch; whatever they hold on that day is what the
database starts with.

1. **Database.** `docker compose up -d` locally; a managed PostgreSQL 18 in Dokploy. Then
   `pnpm db:migrate` and `pnpm db:seed` (the server also migrates on start).
2. **Prove the two agree** before trusting the database: run the two parked tests above.
3. **Server** (`apps/server/src/index.ts` and `dev.ts`): uncomment the `TEMP(json-store)` blocks
   (`connect`, `runMigrations`, `postgresSource`, `mount: (app) => mountEditor(app, database.db)`,
   closing the pool) and remove the `jsonSource()` line. In `env.ts`, uncomment `DATABASE_URL` and
   `SESSION_SECRET`. In `app.ts`, `/healthz` pings the database again.
4. **Web**: `EDITOR_ENABLED = true` in `apps/web/src/routes/admin.tsx`.
5. **Build and deploy**: uncomment the migrations in `Dockerfile`, the service and addresses in
   `../.github/workflows/react.yml`, the test-database lines in `e2e/tools/serve-test.mjs`; set
   `DATABASE_URL` and `SESSION_SECRET` in Dokploy; restore `.env.example`.
6. **Tests**: drop the `POSTGRES_TESTS` exclusion in `vitest.config.ts`; point `csv.test.ts`,
   `jsonld.test.ts` and `site-files.test.ts` back at the test database; remove the `test.skip` line
   in `e2e/admin.spec.ts`; delete `e2e/json-store.spec.ts`.
7. **An editor account**: `EDITOR_PASSWORD='…' pnpm db:user someone@example.org`.
8. **Clean up**: the `grep` at the top should come back empty. Then delete `packages/db/src/json.ts`,
   `json.test.ts`, `apps/server/src/sources/json.ts` and this file, or keep the JSON store on purpose
   as a database-free mode and say so here.

From then on the database is the source and the seed files are only its starting point: edits made
in the editor are not written back to them.
