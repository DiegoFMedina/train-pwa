-- Migración 0006 — couple_id NULLABLE en dishes (catálogo de platos).
--   NULL     → plato del catálogo personal del user (solo él lo ve)
--   NOT NULL → plato del catálogo compartido de la pareja (ambos miembros)
--
-- dish_ingredients NO recibe couple_id: hereda del dish padre.
-- meal_plans NO se toca: SIEMPRE es personal del user. En scope=couple
-- la lectura se cruza para mostrar plans de los 2 miembros, pero cada
-- uno solo puede editar/borrar los suyos (validado en el servicio).

BEGIN;

ALTER TABLE dishes
    ADD COLUMN IF NOT EXISTS couple_id UUID
        REFERENCES couples(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_dish_couple
    ON dishes (couple_id)
    WHERE deleted_at IS NULL AND couple_id IS NOT NULL;

COMMIT;
