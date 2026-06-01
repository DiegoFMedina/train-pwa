-- Migración 0001 — separa quantity (texto libre) en amount + unit estructurados.
-- Permite agregar la lista de compras sumando por (lower(name), unit).
-- La columna quantity se preserva como fallback de display para filas creadas
-- antes de esta migración.

BEGIN;

ALTER TABLE dish_ingredients
  ADD COLUMN IF NOT EXISTS amount NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS unit   VARCHAR(20);

-- Best-effort parse: si quantity es "200 g" / "2 un" / "1.5 kg",
-- intenta poblar amount + unit para no perder data. Patrones no
-- reconocidos se quedan con amount NULL y siguen usando quantity.
UPDATE dish_ingredients
SET
  amount = CAST(REPLACE(SUBSTRING(quantity FROM '^\s*(\d+(?:[\.,]\d+)?)'), ',', '.') AS NUMERIC),
  unit   = LOWER(TRIM(SUBSTRING(quantity FROM '^\s*\d+(?:[\.,]\d+)?\s*(\S+)')))
WHERE quantity IS NOT NULL
  AND amount IS NULL
  AND quantity ~ '^\s*\d+(?:[\.,]\d+)?\s*\S+';

COMMIT;
