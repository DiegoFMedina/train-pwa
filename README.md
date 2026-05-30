# Mi Centro

PWA personal de control: **Finanzas · Rutinas · Dieta**. Offline-first, multi-dispositivo, con notificaciones push.

## Estructura

```
mi-centro/
├── apps/
│   ├── web/                  # Next.js 15 (PWA)  — pendiente
│   └── api/                  # NestJS 11         — pendiente
├── packages/
│   └── shared/               # Tipos + esquemas Zod (contrato front/back)
├── docs/
│   ├── mi_centro_arquitectura.md
│   ├── mi_centro_schema.sql
│   └── mi_centro_prototipo.html
└── pnpm-workspace.yaml
```

## Requisitos

- **Node.js ≥ 22** (probado en 24)
- **pnpm 10** (vía `corepack enable` o `corepack pnpm <cmd>`)

## Comandos

```bash
# instalar todo
corepack pnpm install

# typecheck en todos los paquetes
corepack pnpm typecheck

# build de todos los paquetes
corepack pnpm build
```

## Estado

| Fase | Estado |
|---|---|
| 0 · Setup monorepo | ✅ en curso |
| 0 · `packages/shared` (Zod) | ✅ listo |
| 0 · `apps/api` (NestJS + Drizzle) | ⏳ pendiente |
| 0 · `apps/web` (Next.js 15) | ⏳ pendiente |
| 1 · Finanzas MVP | ⏳ |
| 4 · Sync + Push | ⏳ |

Ver [docs/mi_centro_arquitectura.md](docs/mi_centro_arquitectura.md) para detalle del stack y roadmap.
