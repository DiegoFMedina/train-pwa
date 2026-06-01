# Mi Centro

PWA personal de control: **Finanzas · Rutinas · Dieta**. Offline-ready, multi-dispositivo, con base para notificaciones push.

## Estructura

```
mi-centro/
├── apps/
│   ├── api/                # NestJS 11 + Drizzle + PostgreSQL
│   └── web/                # Next.js 15 + Tailwind 4 + PWA
├── packages/
│   └── shared/             # Tipos + esquemas Zod (contrato front/back)
├── docs/
│   ├── mi_centro_arquitectura.md
│   ├── mi_centro_schema.sql
│   └── mi_centro_prototipo.html
└── pnpm-workspace.yaml
```

## Requisitos

- **Node.js ≥ 22** (probado en 24)
- **pnpm 10** (`npm i -g pnpm` o vía corepack)
- **PostgreSQL 16+** con extensiones `uuid-ossp` y `citext`

## Setup

```powershell
# 1. instalar deps
pnpm install

# 2. crear BD y aplicar schema
$env:PGPASSWORD = "tu-password"
createdb -U postgres mi_centro
psql -U postgres -d mi_centro -f docs/mi_centro_schema.sql

# 3. configurar API
cp apps/api/.env.example apps/api/.env
# editar DATABASE_URL y los JWT_*_SECRET

# 4. build + arrancar
pnpm --filter @mi-centro/shared build
pnpm --filter @mi-centro/api build
pnpm --filter @mi-centro/api start   # :3001
pnpm --filter @mi-centro/web dev     # :3000
```

## Comandos

```bash
pnpm -r typecheck   # validar tipos en los 3 paquetes
pnpm -r build       # build de todos
pnpm --filter @mi-centro/api dev    # API con watch
pnpm --filter @mi-centro/web dev    # Next dev (SW desactivado)
pnpm --filter @mi-centro/web start  # Next prod (SW activo, requiere build previo)
```

## Estado

| Fase | Alcance | Estado |
|---|---|---|
| 0 | Monorepo + shared + auth + /me + CORS + PWA shell | ✅ |
| 1 | Finanzas: categorías, transactions, recurring, goals, contributions, summary | ✅ |
| 2 | Rutinas: CRUD + RRULE expand + logs + stats | ✅ |
| 3 | Dieta: dishes + ingredients + meal_plans + shopping list | ✅ |
| 4 | Sync offline-first (Dexie + outbox + `/sync/push|pull`) + Web Push activo | ⏳ |

## Pantallas (web)

- `/login` — registro y entrada
- `/hoy` — saludo + balance del mes + movimientos recientes
- `/finanzas` — balance, breakdown por categoría, metas, CRUD movimientos, CRUD categorías
- `/rutinas` — ring de cumplimiento del día, checklist, crear rutina con RRULE diario/días
- `/dieta` — comidas del día con cocinar/comer, catálogo de platos, lista de compras agregada
- `/offline` — pantalla fallback servida por el Service Worker

## API (resumen)

```
POST   /api/auth/register | login | refresh | logout
GET    /api/me                                  PATCH /api/me

# Finanzas
GET/POST /api/categories                        PATCH/DELETE /api/categories/:id
GET/POST /api/transactions ?from&to&kind&category_id
PATCH/DELETE /api/transactions/:id
GET/POST/PATCH/DELETE /api/recurring-transactions
GET/POST/PATCH/DELETE /api/goals
GET/POST/DELETE /api/goals/:id/contributions
GET    /api/finance/summary ?month=YYYY-MM

# Rutinas
GET/POST/PATCH/DELETE /api/routines
GET    /api/routines/instances ?date=YYYY-MM-DD
POST   /api/routines/logs   { routine_id, due_on, status }
GET    /api/routines/:id/stats ?from&to

# Dieta
GET/POST/PATCH/DELETE /api/dishes
GET/POST/DELETE /api/dishes/:id/ingredients
GET/POST/PATCH/DELETE /api/meal-plans ?date=YYYY-MM-DD
GET    /api/meal-plans/shopping-list ?from&to

# Sistema
GET    /api/health
```

## PWA

- `manifest.webmanifest` con start_url `/hoy` + 2 shortcuts (nuevo movimiento, rutinas de hoy)
- Iconos: SVG vectorial + PNG 192/512 + apple-touch-icon 180×180 + maskable
- Service Worker (`/sw.js`) con:
  - Pre-cache de las 4 pantallas + offline page al instalar
  - `network-first` para navegación HTML, `stale-while-revalidate` para `_next/static`
  - Bypass total para `/api` (siempre red)
  - Listeners de `push` y `notificationclick` listos para cuando entre el cron de reminders

SW solo se registra en `next start` (prod build). En `next dev` no se registra para no chocar con HMR.

Ver [docs/mi_centro_arquitectura.md](docs/mi_centro_arquitectura.md) para stack y roadmap completos.
