# Imagen única de la API; el modo (edge/cloud) se elige con CONVIVIUM_MODE.
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile --filter @convivium/api...

FROM base AS web
COPY apps/mesero ./apps/mesero
COPY apps/estacion ./apps/estacion
COPY apps/caja ./apps/caja
COPY apps/admin ./apps/admin
RUN pnpm install --frozen-lockfile && NODE_ENV=production pnpm -r --filter "./apps/{mesero,estacion,caja,admin}" build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=web /repo/apps/mesero/dist /srv/web/mesero
COPY --from=web /repo/apps/estacion/dist /srv/web/estacion
COPY --from=web /repo/apps/caja/dist /srv/web/caja
COPY --from=web /repo/apps/admin/dist /srv/web/admin
WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["pnpm", "exec", "tsx", "src/index.ts"]
