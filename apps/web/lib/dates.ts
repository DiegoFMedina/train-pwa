/**
 * Helpers de fecha trabajando con strings YYYY-MM-DD para evitar drift
 * de timezone. Toda la app usa fechas-solo (no datetimes) para meal_plans.
 */

export function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseYmd(ymd: string): Date {
  return new Date(`${ymd}T00:00:00Z`);
}

export function addDays(ymd: string, days: number): string {
  const d = parseYmd(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return toYmd(d);
}

export function monthRange(year: number, month0: number): { from: string; to: string } {
  const first = new Date(Date.UTC(year, month0, 1));
  const last = new Date(Date.UTC(year, month0 + 1, 0));
  return { from: toYmd(first), to: toYmd(last) };
}

/**
 * Devuelve la grilla completa del mes incluyendo padding al inicio (días del
 * mes anterior para completar la semana que empieza en lunes) y al final.
 * Siempre devuelve un múltiplo de 7, generalmente 35 o 42 celdas.
 */
export function monthGrid(year: number, month0: number): Array<{
  ymd: string;
  day: number;
  inMonth: boolean;
}> {
  const first = new Date(Date.UTC(year, month0, 1));
  // ISO day of week: lunes=1 ... domingo=7. JS getUTCDay: domingo=0 ... sábado=6.
  const jsDow = first.getUTCDay();
  const leadingPad = jsDow === 0 ? 6 : jsDow - 1; // cuántos días del mes anterior agregar
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - leadingPad);

  const cells: Array<{ ymd: string; day: number; inMonth: boolean }> = [];
  // 6 filas máximo → 42 celdas. Cortamos a 35 si la última fila es entera de
  // siguiente mes (mes corto que cabe en 5 filas).
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    cells.push({
      ymd: toYmd(d),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month0,
    });
  }
  // Si la última semana es 100% "fuera del mes", recortamos a 35.
  if (cells.slice(35).every((c) => !c.inMonth)) return cells.slice(0, 35);
  return cells;
}

export function weekRangeContaining(ymd: string): { from: string; to: string } {
  const d = parseYmd(ymd);
  const jsDow = d.getUTCDay();
  const offsetToMonday = jsDow === 0 ? 6 : jsDow - 1;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - offsetToMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { from: toYmd(monday), to: toYmd(sunday) };
}

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function monthLabel(year: number, month0: number): string {
  return `${MONTHS_ES[month0]} ${year}`;
}

export function shortDateFromYmd(ymd: string): string {
  const d = parseYmd(ymd);
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" }).format(d);
}

export function fullDateFromYmd(ymd: string): string {
  const d = parseYmd(ymd);
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}
