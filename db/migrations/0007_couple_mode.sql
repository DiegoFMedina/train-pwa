-- Migración 0007 — modo financiero del couple.
--   "separate" (default): cada miembro tiene scope Personal + scope Couple.
--                          Modelo "mis cosas + lo común del hogar".
--   "unified":             solo existe scope Couple. Sin scope Personal.
--                          Modelo "todo compartido, sin secretos".
--
-- Cambiar el modo no destruye datos. Si pasas de unified a separate, los
-- datos personales que ambos puedan tener desde antes reaparecen. Si pasas
-- de separate a unified, los personales se ocultan en UI pero siguen en BD.

BEGIN;

ALTER TABLE couples
    ADD COLUMN IF NOT EXISTS mode VARCHAR(12) NOT NULL DEFAULT 'separate'
        CHECK (mode IN ('separate','unified'));

COMMIT;
