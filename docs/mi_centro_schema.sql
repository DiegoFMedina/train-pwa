-- ============================================================
--  MI CENTRO — Esquema de Base de Datos (PostgreSQL)
--  App personal de control: Finanzas + Rutinas + Dieta
--  Offline-first · Multi-dispositivo · PWA
-- ============================================================

-- ----- Extensiones -----
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- IDs UUID
CREATE EXTENSION IF NOT EXISTS "citext";     -- email case-insensitive

-- ============================================================
--  CONVENCIONES DE SINCRONIZACIÓN (presentes en todas las tablas)
--  created_at / updated_at : timestamps en UTC
--  deleted_at              : soft-delete (NULL = activo)
--  version                 : entero incremental para detectar
--                            conflictos en sync (optimistic locking)
--  La sync por delta consulta: WHERE updated_at > ultimo_sync
-- ============================================================


-- ============================================================
--  NÚCLEO — Usuarios y dispositivos
-- ============================================================

CREATE TABLE users (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email             CITEXT UNIQUE NOT NULL,
    name              VARCHAR(120) NOT NULL,
    password_hash     TEXT NOT NULL,                       -- bcrypt/argon2
    timezone          VARCHAR(64)  NOT NULL DEFAULT 'America/Santiago',
    language          VARCHAR(5)   NOT NULL DEFAULT 'es',  -- es | en
    theme             VARCHAR(10)  NOT NULL DEFAULT 'system', -- light|dark|system
    default_currency  CHAR(3)      NOT NULL DEFAULT 'CLP',
    -- Horario "no molestar" global (las notificaciones no se disparan aquí)
    quiet_hours_start TIME,
    quiet_hours_end   TIME,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Suscripciones Web Push (una por dispositivo/navegador)
CREATE TABLE push_subscriptions (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint      TEXT NOT NULL,
    p256dh        TEXT NOT NULL,
    auth          TEXT NOT NULL,
    device_label  VARCHAR(80),            -- "iPhone de Diego", "Notebook"
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, endpoint)
);


-- ============================================================
--  MÓDULO FINANZAS
-- ============================================================

-- Categorías de ingreso/gasto (configurables por el usuario)
CREATE TABLE categories (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(80) NOT NULL,
    kind        VARCHAR(10) NOT NULL CHECK (kind IN ('income','expense')),
    color       VARCHAR(7),             -- #RRGGBB
    icon        VARCHAR(40),            -- nombre de ícono
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    version     INTEGER NOT NULL DEFAULT 1
);

-- Movimientos recurrentes (sueldo, arriendo, suscripciones...)
CREATE TABLE recurring_transactions (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id  UUID REFERENCES categories(id) ON DELETE SET NULL,
    kind         VARCHAR(10) NOT NULL CHECK (kind IN ('income','expense')),
    amount       NUMERIC(14,2) NOT NULL,
    currency     CHAR(3) NOT NULL DEFAULT 'CLP',
    description  TEXT,
    rrule        TEXT NOT NULL,          -- RFC 5545, ej: FREQ=MONTHLY;BYMONTHDAY=5
    next_run_on  DATE NOT NULL,          -- próxima fecha a auto-registrar
    active       BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMPTZ,
    version      INTEGER NOT NULL DEFAULT 1
);

-- Movimientos reales (ingresos / gastos)
CREATE TABLE transactions (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
    kind          VARCHAR(10) NOT NULL CHECK (kind IN ('income','expense')),
    amount        NUMERIC(14,2) NOT NULL,
    currency      CHAR(3) NOT NULL DEFAULT 'CLP',
    description   TEXT,
    occurred_on   DATE NOT NULL,         -- fecha del movimiento
    recurring_id  UUID REFERENCES recurring_transactions(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ,
    version       INTEGER NOT NULL DEFAULT 1
);

-- Metas financieras (ej: ahorrar para un viaje)
CREATE TABLE financial_goals (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          VARCHAR(120) NOT NULL,
    target_amount NUMERIC(14,2) NOT NULL,
    currency      CHAR(3) NOT NULL DEFAULT 'CLP',
    target_date   DATE,
    status        VARCHAR(12) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','achieved','archived')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ,
    version       INTEGER NOT NULL DEFAULT 1
);

-- Aportes a metas (historial -> habilita la vista comparativa)
CREATE TABLE goal_contributions (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    goal_id      UUID NOT NULL REFERENCES financial_goals(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount       NUMERIC(14,2) NOT NULL,
    occurred_on  DATE NOT NULL DEFAULT CURRENT_DATE,
    note         TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMPTZ,
    version      INTEGER NOT NULL DEFAULT 1
);


-- ============================================================
--  MÓDULO RUTINAS
-- ============================================================

-- Definición de la rutina/hábito (con recurrencia y recordatorio)
CREATE TABLE routines (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title            VARCHAR(120) NOT NULL,
    notes            TEXT,
    rrule            TEXT NOT NULL,        -- ej: FREQ=WEEKLY;BYDAY=MO,WE,FR
    time_of_day      TIME NOT NULL,        -- hora del bloque/recordatorio
    duration_minutes INTEGER DEFAULT 30,   -- para reservar espacio en calendario
    notify_mode      VARCHAR(12) NOT NULL DEFAULT 'notify'
                     CHECK (notify_mode IN ('notify','vibrate','silent')),
    active           BOOLEAN NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ,
    version          INTEGER NOT NULL DEFAULT 1
);

-- Registro de cumplimiento por instancia/día
-- (esto alimenta rachas, % de cumplimiento y comparativas)
CREATE TABLE routine_logs (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    routine_id   UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    due_on       DATE NOT NULL,            -- el día que tocaba
    status       VARCHAR(10) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','done','skipped','missed')),
    completed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMPTZ,
    version      INTEGER NOT NULL DEFAULT 1,
    UNIQUE (routine_id, due_on)
);


-- ============================================================
--  MÓDULO DIETA
-- ============================================================

-- Catálogo de platos reutilizables
CREATE TABLE dishes (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          VARCHAR(120) NOT NULL,
    notes         TEXT,
    prep_minutes  INTEGER,                 -- tiempo estimado de preparación
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ,
    version       INTEGER NOT NULL DEFAULT 1
);

-- Ingredientes de cada plato (habilita la lista de compras automática)
CREATE TABLE dish_ingredients (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dish_id     UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(120) NOT NULL,
    -- Cantidad estructurada: permite sumar la lista de compras por
    -- (lower(name), unit). amount NULL = "al gusto" / sin medir.
    amount      NUMERIC(10,3),
    unit        VARCHAR(20),
    -- Texto libre legacy. Display fallback cuando amount IS NULL.
    quantity    VARCHAR(60),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    version     INTEGER NOT NULL DEFAULT 1
);

-- Planificación de comidas por día
CREATE TABLE meal_plans (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dish_id      UUID REFERENCES dishes(id) ON DELETE SET NULL,
    plan_date    DATE NOT NULL,
    meal_type    VARCHAR(12) NOT NULL
                 CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
    cook_time    TIME,                     -- a qué hora cocino (configurable)
    eat_time     TIME,                     -- a qué hora como (opcional)
    notify_mode  VARCHAR(12) NOT NULL DEFAULT 'notify'
                 CHECK (notify_mode IN ('notify','vibrate','silent')),
    status       VARCHAR(10) NOT NULL DEFAULT 'planned'
                 CHECK (status IN ('planned','eaten','skipped')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMPTZ,
    version      INTEGER NOT NULL DEFAULT 1
);


-- ============================================================
--  NOTIFICACIONES — Cola de recordatorios
--  Un cron del backend escanea fire_at <= now() AND status='pending'
--  y dispara Web Push / email / in-app según notify_mode.
-- ============================================================

CREATE TABLE reminders (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_type  VARCHAR(20) NOT NULL
                 CHECK (source_type IN ('routine','meal','goal','transaction')),
    source_id    UUID NOT NULL,            -- id de la rutina/comida/etc
    title        VARCHAR(160) NOT NULL,
    body         TEXT,
    fire_at      TIMESTAMPTZ NOT NULL,     -- cuándo disparar (UTC)
    notify_mode  VARCHAR(12) NOT NULL DEFAULT 'notify'
                 CHECK (notify_mode IN ('notify','vibrate','silent')),
    status       VARCHAR(12) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','sent','cancelled')),
    sent_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
--  ÍNDICES (consultas frecuentes)
-- ============================================================

-- Finanzas: listar/filtrar por usuario y fecha
CREATE INDEX idx_tx_user_date      ON transactions (user_id, occurred_on)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_tx_user_category  ON transactions (user_id, category_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_cat_user          ON categories (user_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_goal_user         ON financial_goals (user_id)
    WHERE deleted_at IS NULL;

-- Rutinas: cumplimiento por día
CREATE INDEX idx_routine_user      ON routines (user_id)
    WHERE deleted_at IS NULL AND active = true;
CREATE INDEX idx_rlog_user_date    ON routine_logs (user_id, due_on)
    WHERE deleted_at IS NULL;

-- Dieta: plan por día
CREATE INDEX idx_meal_user_date    ON meal_plans (user_id, plan_date)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_dish_user         ON dishes (user_id)
    WHERE deleted_at IS NULL;

-- Notificaciones: el cron busca pendientes por disparar
CREATE INDEX idx_reminders_due     ON reminders (fire_at)
    WHERE status = 'pending';

-- Sync por delta: cada tabla se consulta por updated_at
CREATE INDEX idx_tx_sync       ON transactions   (user_id, updated_at);
CREATE INDEX idx_routine_sync  ON routines       (user_id, updated_at);
CREATE INDEX idx_rlog_sync     ON routine_logs   (user_id, updated_at);
CREATE INDEX idx_meal_sync     ON meal_plans     (user_id, updated_at);


-- ============================================================
--  TRIGGER: auto-actualizar updated_at + version en cada UPDATE
-- ============================================================

CREATE OR REPLACE FUNCTION touch_row() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    NEW.version    := OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a las tablas con control de versión
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'categories','transactions','recurring_transactions',
        'financial_goals','goal_contributions',
        'routines','routine_logs',
        'dishes','dish_ingredients','meal_plans'
    ] LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_touch_%1$s BEFORE UPDATE ON %1$s
             FOR EACH ROW EXECUTE FUNCTION touch_row();', t);
    END LOOP;
END $$;
