# syntax=docker/dockerfile:1.7
# todoi.org: one Node process serving pages, API, generated files and assets.
# Dokploy builds this from the repository; Traefik terminates TLS in front of it.

ARG NODE_VERSION=22.21.1

# --- build: install, typecheck-free production build ---------------------------
FROM node:${NODE_VERSION}-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

# Manifests first, so dependency layers are cached across code changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# --- runtime: no node_modules, no source, not root ------------------------------
# Both bundles carry their dependencies; the image holds the build output, the
# SQL migrations and nothing else.
FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    WEB_DIST=/app/web \
    MIGRATIONS_DIR=/app/migrations \
    TRUST_PROXY=true
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/server/dist ./server
COPY --from=build --chown=node:node /app/apps/web/dist ./web
COPY --from=build --chown=node:node /app/packages/db/migrations ./migrations
USER node
EXPOSE 3000

# Liveness includes a database ping (/healthz answers 503 when the database is down).
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

# Migrations run at start, before the server listens.
CMD ["node", "--enable-source-maps", "server/index.js"]
