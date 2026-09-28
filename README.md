# CONVIVIUM

*Donde todo sucede en la mesa.* Software de gestión para bar-restaurantes en México.

- Requerimientos y alcance: [docs/01](docs/01-levantamiento-requerimientos.md) · [02](docs/02-alcance-y-flujos.md) · [03 historias de usuario](docs/03-historias-de-usuario-mvp.md)
- Diseño UI (Stitch): [docs/04](docs/04-diseno-ui-stitch.md)
- Arquitectura: [docs/05](docs/05-arquitectura-tecnica.md) · Código y APIs: [docs/06](docs/06-estructura-codigo-y-apis.md)

## Arranque rápido

```bash
pnpm install
cp .env.example .env
pnpm db:migrate && pnpm db:seed
pnpm dev:api                          # API + docs en http://localhost:4000/docs
pnpm --filter @convivium/mesero dev   # 5101 · estacion 5102 · caja 5103 · admin 5104
```

Comandos: `pnpm typecheck` · `pnpm test` · `pnpm db:generate` (nueva migración tras cambiar el esquema).
