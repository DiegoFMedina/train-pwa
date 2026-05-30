# @mi-centro/api

Backend NestJS 11 + Drizzle ORM + PostgreSQL 16.

## Arranque local

```bash
# 1. copiar .env y completar DATABASE_URL
cp .env.example .env

# 2. instalar deps (desde la raíz del monorepo)
pnpm install

# 3. crear la BD y aplicar el schema base (extensiones + tablas)
psql "$DATABASE_URL" -f ../../docs/mi_centro_schema.sql

# 4. levantar dev
pnpm --filter @mi-centro/api dev

# 5. verificar
curl http://localhost:3001/api/health
```

## Migraciones (Drizzle Kit)

El schema canónico de arranque vive en [`docs/mi_centro_schema.sql`](../../docs/mi_centro_schema.sql) — se aplica una sola vez con `psql`.

De ahí en adelante, los cambios se gestionan con Drizzle Kit:

```bash
pnpm db:generate   # genera migración SQL desde el diff del schema.ts
pnpm db:migrate    # aplica migraciones pendientes
pnpm db:studio     # abre la UI de inspección
```

> El alcance del `schema.ts` actual es **Fase 1 (Finanzas)**: users, push_subscriptions, categories, transactions, recurring_transactions, financial_goals, goal_contributions. Las tablas de rutinas, dieta y reminders se agregan al entrar en sus respectivas fases.
