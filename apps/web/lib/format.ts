const clpFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export function money(amount: number, currency = "CLP"): string {
  if (currency === "CLP") return clpFormatter.format(amount);
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function signedMoney(amount: number, kind: "income" | "expense", currency = "CLP"): string {
  const sign = kind === "income" ? "+" : "−";
  return `${sign}${money(amount, currency)}`;
}

const dayFormatter = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
});

export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return dayFormatter.format(d);
}

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
