-- Migración 0005 — fix del UNIQUE de routine_logs
-- La 0004 creó el unique con WHERE deleted_at IS NULL (parcial), pero eso
-- impide usar ON CONFLICT en INSERT sin agregar la misma WHERE al INSERT.
-- Hacemos el unique no-parcial: si existe un log soft-deleted con la misma
-- key, el ON CONFLICT DO UPDATE lo "revive" reseteando deleted_at a null.

BEGIN;

DROP INDEX IF EXISTS routine_logs_routine_user_day_uq;

CREATE UNIQUE INDEX routine_logs_routine_user_day_uq
    ON routine_logs (routine_id, user_id, due_on);

COMMIT;
