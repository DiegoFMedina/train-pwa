-- Migración 0003 — agrega couple_id (nullable) a las 5 tablas de Finanzas.
-- Habilita el scope Personal vs Compartido sin migrar datos existentes:
--   couple_id IS NULL    → entidad personal (privada del user_id)
--   couple_id IS NOT NULL → entidad de la pareja (visible para todos sus members)
--
-- Las tablas mantienen user_id como creator/owner (útil para audit y futura
-- vista "quién creó esto"). El permiso de lectura/escritura para entidades
-- compartidas se decide en el servicio: si tu user_id está en
-- couple_members(couple_id), puedes leer y editar.

BEGIN;

-- categories
ALTER TABLE categories
    ADD COLUMN IF NOT EXISTS couple_id UUID
        REFERENCES couples(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_cat_couple
    ON categories (couple_id)
    WHERE deleted_at IS NULL AND couple_id IS NOT NULL;

-- transactions
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS couple_id UUID
        REFERENCES couples(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tx_couple_date
    ON transactions (couple_id, occurred_on)
    WHERE deleted_at IS NULL AND couple_id IS NOT NULL;

-- recurring_transactions
ALTER TABLE recurring_transactions
    ADD COLUMN IF NOT EXISTS couple_id UUID
        REFERENCES couples(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_recurring_couple
    ON recurring_transactions (couple_id)
    WHERE deleted_at IS NULL AND couple_id IS NOT NULL;

-- financial_goals
ALTER TABLE financial_goals
    ADD COLUMN IF NOT EXISTS couple_id UUID
        REFERENCES couples(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_goal_couple
    ON financial_goals (couple_id)
    WHERE deleted_at IS NULL AND couple_id IS NOT NULL;

-- goal_contributions — hereda el scope de la meta. NO le ponemos couple_id
-- propio porque siempre se infiere de su goal. La lectura/escritura se
-- valida contra el couple_id del goal padre.
-- (Decisión: dejar la tabla como está; los aportes a una meta de pareja
-- son visibles para los miembros y filtrados por el join con la meta.)

COMMIT;
