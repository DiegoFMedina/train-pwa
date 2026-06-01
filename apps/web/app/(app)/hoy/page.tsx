"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { currentMonth, money, shortDate, signedMoney } from "@/lib/format";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Trasnochando";
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function todayLong(): string {
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

export default function HoyPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const firstName = user?.name.split(" ")[0] ?? "";

  const month = currentMonth();
  const summary = useQuery({
    queryKey: ["summary", month],
    queryFn: () => api.summary.monthly(month),
  });
  const recent = useQuery({
    queryKey: ["transactions", "recent"],
    queryFn: () => api.transactions.list({}),
    select: (rows) => rows.slice(0, 5),
  });

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-32">
      <header className="mb-7">
        <p className="eyebrow mb-1.5">{todayLong()}</p>
        <h1 className="text-5xl font-light" style={{ fontFamily: "var(--font-serif)" }}>
          {greeting()},<br />
          <span className="italic" style={{ color: "var(--color-accent)" }}>
            {firstName}
          </span>
        </h1>
      </header>

      {/* Balance del mes */}
      <section
        className="card mb-6 cursor-pointer hover:bg-[color:var(--color-surface-2)] transition-colors"
        onClick={() => router.push("/finanzas")}
        role="link"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && router.push("/finanzas")}
      >
        <div className="flex items-center justify-between mb-2">
          <p className="eyebrow">Balance del mes</p>
          <span className="pill">{month}</span>
        </div>
        {summary.isLoading ? (
          <div className="h-14 animate-pulse bg-[color:var(--color-surface-2)] rounded-lg" />
        ) : summary.data ? (
          <>
            <p className="mono text-4xl font-light tracking-tight">
              {summary.data.balance >= 0 ? "" : "−"}
              {money(Math.abs(summary.data.balance))}
            </p>
            <div className="mt-3 flex gap-6">
              <div>
                <p className="text-[10px] text-[color:var(--color-ink-faint)]">Ingresos</p>
                <p className="mono text-sm text-[color:var(--color-up)] font-semibold">
                  +{money(summary.data.income)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[color:var(--color-ink-faint)]">Gastos</p>
                <p className="mono text-sm text-[color:var(--color-down)] font-semibold">
                  −{money(summary.data.expense)}
                </p>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-[color:var(--color-down)]">Sin datos.</p>
        )}
      </section>

      {/* Pendientes — placeholder hasta tener rutinas/dieta */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[color:var(--color-ink-soft)]">
            Pendientes de hoy
          </h2>
          <span className="pill">próximamente</span>
        </div>
        <div className="card text-center py-7 text-sm text-[color:var(--color-ink-faint)]">
          Rutinas y comidas aparecerán acá cuando entren las fases 2 y 3.
        </div>
      </section>

      {/* Movimientos recientes */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[color:var(--color-ink-soft)]">
            Movimientos recientes
          </h2>
          <button
            onClick={() => router.push("/finanzas")}
            className="text-xs text-[color:var(--color-accent)] font-medium"
          >
            Ver todos →
          </button>
        </div>

        {recent.isLoading ? (
          <div className="card h-20 animate-pulse" />
        ) : (recent.data ?? []).length === 0 ? (
          <div className="card text-center text-sm text-[color:var(--color-ink-faint)]">
            Sin movimientos aún.
          </div>
        ) : (
          <div className="card space-y-3">
            {recent.data!.map((t) => (
              <div key={t.id} className="flex items-center gap-3">
                <span
                  className="w-9 h-9 rounded-full grid place-items-center flex-shrink-0"
                  style={{
                    background: "var(--color-surface-2)",
                    color:
                      t.kind === "income"
                        ? "var(--color-up)"
                        : "var(--color-down)",
                  }}
                >
                  {t.kind === "income" ? "↑" : "↓"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {t.description ?? "—"}
                  </p>
                  <p className="text-xs text-[color:var(--color-ink-faint)]">
                    {shortDate(t.occurred_on)}
                  </p>
                </div>
                <p
                  className={`mono text-sm font-medium ${
                    t.kind === "income"
                      ? "text-[color:var(--color-up)]"
                      : "text-[color:var(--color-down)]"
                  }`}
                >
                  {signedMoney(t.amount, t.kind, t.currency)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
