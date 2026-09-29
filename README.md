# CONVIVIUM

*Donde todo sucede en la mesa.* Software de gestión para bar-restaurantes en México.

- Requerimientos y alcance: [docs/01](docs/01-levantamiento-requerimientos.md) · [02](docs/02-alcance-y-flujos.md) · [03 historias de usuario](docs/03-historias-de-usuario-mvp.md)
- Diseño UI (Stitch): [docs/04](docs/04-diseno-ui-stitch.md)
- Arquitectura: [docs/05](docs/05-arquitectura-tecnica.md) · Código y APIs: [docs/06](docs/06-estructura-codigo-y-apis.md)
- **Despliegue (nube y nodo): [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md)**
- **Manual para el cliente:** [docs/sitio-cliente](docs/sitio-cliente/index.html) — la API lo sirve en `/ayuda/`

## Arranque rápido

```bash
pnpm install
cp .env.example .env
pnpm db:migrate && pnpm db:seed
pnpm dev:api                          # API + docs en http://localhost:4000/docs
pnpm --filter @convivium/mesero dev   # 5101 · estacion 5102 · caja 5103 · admin 5104
```

Comandos: `pnpm typecheck` · `pnpm test` (reglas + integración contra Postgres) · `pnpm db:generate` (nueva migración tras cambiar el esquema).

Usuarios de prueba (solo el seed de demo): dueño `dueno@demo.mx` / `demo12345`; PINs 1111 dueño, 2222 gerente,
3333 capitán, 4444 mesero, 5555 cajero, 6666 cocina, 7777 barra, 8888 almacén; código de vinculación `482913`.
Empresa real sin datos de demo: `pnpm --filter @convivium/db setup -- --empresa … --email … --password … --pin …`.
