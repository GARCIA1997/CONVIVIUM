# Imagen única de CONVIVIUM: API + las 4 PWA compiladas. El modo se elige con CONVIVIUM_MODE (edge | cloud).
# Al arrancar aplica las migraciones pendientes (AUTO_MIGRATE=true).
FROM node:20-alpine AS deps
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
COPY docs/sitio-cliente ./docs/sitio-cliente
RUN pnpm install --frozen-lockfile

FROM deps AS web
RUN NODE_ENV=production pnpm -r --filter "./apps/{mesero,estacion,caja,admin}" build

FROM node:20-alpine AS runtime
RUN corepack enable
WORKDIR /repo
ENV NODE_ENV=production WEB_ROOT=/srv/web PORT=4000
COPY --from=deps /repo /repo
COPY --from=web /repo/apps/mesero/dist /srv/web/mesero
COPY --from=web /repo/apps/estacion/dist /srv/web/estacion
COPY --from=web /repo/apps/caja/dist /srv/web/caja
COPY --from=web /repo/apps/admin/dist /srv/web/admin
WORKDIR /repo/apps/api
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=5 CMD wget -qO- http://127.0.0.1:4000/health || exit 1
CMD ["pnpm", "exec", "tsx", "src/index.ts"]
