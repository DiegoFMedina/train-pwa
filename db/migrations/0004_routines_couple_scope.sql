-- Migración 0004 — couple_id (nullable) en routines.
-- Las rutinas pueden ser personales (couple_id IS NULL) o de la pareja.
-- Los logs (routine_logs) siguen siendo POR USUARIO — cada miembro marca
-- su propio cumplimiento aunque la rutina sea compartida. El UNIQUE en
-- (routine_id, due_on) cambia a (routine_id, user_id, due_on) para
-- permitir un log por miembro.

BEGIN;

ALTER TABLE routines
    ADD COLUMN IF NOT EXISTS couple_id UUID
        REFERENCES couples(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_routine_couple
    ON routines (couple_id)
    WHERE deleted_at IS NULL AND active = true AND couple_id IS NOT NULL;

-- Drop el UNIQUE antiguo (routine_id, due_on) y crear el nuevo que incluye user_id.
-- Esto permite que ambos miembros de la pareja marquen su check para la
-- misma rutina y el mismo día sin conflicto.
ALTER TABLE routine_logs
    DROP CONSTRAINT IF EXISTS routine_logs_routine_id_due_on_key;

DROP INDEX IF EXISTS routine_logs_routine_day_uq;

CREATE UNIQUE INDEX IF NOT EXISTS routine_logs_routine_user_day_uq
    ON routine_logs (routine_id, user_id, due_on)
    WHERE deleted_at IS NULL;

COMMIT;
