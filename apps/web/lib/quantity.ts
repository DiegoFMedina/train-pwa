/**
 * Parsing y formato de cantidades flexibles. Acepta:
 *   - decimales: "1.5", "0.25", "1,5" (coma europea)
 *   - fracciones: "1/2", "3/4"
 *   - mixtas: "1 1/2", "2 3/4"
 *   - vacío: null
 */

export function parseQuantity(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;

  // Reemplazar símbolos unicode comunes
  const normalized = s
    .replace(/½/g, " 1/2")
    .replace(/¼/g, " 1/4")
    .replace(/¾/g, " 3/4")
    .replace(/⅓/g, " 1/3")
    .replace(/⅔/g, " 2/3")
    .replace(/⅛/g, " 1/8")
    .replace(/,/g, ".")
    .trim();

  // "1 1/2" → 1.5
  const mixed = normalized.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const w = Number(mixed[1]);
    const num = Number(mixed[2]);
    const den = Number(mixed[3]);
    if (den === 0) return null;
    return w + num / den;
  }

  // "1/2" → 0.5
  const frac = normalized.match(/^(\d+)\/(\d+)$/);
  if (frac) {
    const num = Number(frac[1]);
    const den = Number(frac[2]);
    if (den === 0) return null;
    return num / den;
  }

  // "1.5" / "0.25"
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/**
 * Formato amigable: 0.5 → "½", 1.5 → "1 ½", 1 → "1", 1.333 → "1.33".
 */
export function formatQuantity(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (n === 0) return "0";

  const FRACTIONS: Array<[number, string]> = [
    [1 / 8, "⅛"],
    [1 / 4, "¼"],
    [1 / 3, "⅓"],
    [1 / 2, "½"],
    [2 / 3, "⅔"],
    [3 / 4, "¾"],
  ];

  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const whole = Math.floor(abs);
  const remainder = abs - whole;

  // Match exacto o casi exacto contra fracciones comunes
  for (const [val, sym] of FRACTIONS) {
    if (Math.abs(remainder - val) < 0.005) {
      if (whole === 0) return `${sign}${sym}`;
      return `${sign}${whole} ${sym}`;
    }
  }

  // Entero
  if (Math.abs(remainder) < 0.005) return `${sign}${whole}`;

  // Decimal limpio
  return `${sign}${Number(abs.toFixed(2))
    .toString()
    .replace(/\.?0+$/, "")}`;
}

/** Combina cantidad + unidad: 0.5 + "taza" → "½ taza"; 1.5 + null → "1 ½". */
export function formatQuantityWithUnit(
  amount: number | null,
  unit: string | null,
): string {
  if (amount === null || amount === undefined) return "";
  const q = formatQuantity(amount);
  return unit ? `${q} ${unit}` : q;
}
