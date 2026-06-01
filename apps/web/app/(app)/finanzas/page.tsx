"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { currentMonth, money } from "@/lib/format";
import { CategoriesSheet } from "./categories-sheet";
import { GoalsSection } from "./goals-section";
import { NewTransactionForm } from "./new-transaction";
import { TransactionItem } from "./transaction-item";

export default function FinanzasPage() {
  const [catsOpen, setCatsOpen] = useState(false);
  const month = currentMonth();

  const summary = useQuery({
    queryKey: ["summary", month],
    queryFn: () => api.summary.monthly(month),
  });
  const txs = useQuery({
    queryKey: ["transactions", { from: `${month}-01` }],
    queryFn: () => api.transactions.list({ from: `${month}-01` }),
  });
  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.categories.list(),
  });

  const catMap = new Map((cats.data ?? []).map((c) => [c.id, c]));
  const used = summary.data
    ? Math.min(
        100,
        Math.round((summary.data.expense / Math.max(1, summary.data.income)) * 100),
      )
    : 0;

  return (
    <main className="mx-auto max-w-md min-h-dvh px-5 pt-16 pb-32">
      <header className="mb-7">
        <p className="eyebrow mb-1.5">
          {new Date().toLocaleDateString("es-CL", { month: "long", year: "numeric" })}
        </p>
        <h1 className="text-5xl font-light" style={{ fontFamily: "var(--font-serif)" }}>
          Finanzas
        </h1>
      </header>

      {/* Hero balance */}
      <section className="card mb-6">
        <p className="eyebrow mb-2">Balance del mes</p>
        {summary.isLoading ? (
          <div className="h-16 animate-pulse bg-[color:var(--color-surface-2)] rounded-lg" />
        ) : summary.data ? (
          <>
            <p className="mono text-4xl font-light tracking-tight">
              {summary.data.balance >= 0 ? "" : "−"}
              {money(Math.abs(summary.data.balance))}
            </p>
            <div className="mt-4 flex gap-6">
              <div>
                <p className="eyebrow">Ingresos</p>
                <p className="mono text-[color:var(--color-up)] font-semibold">
                  +{money(summary.data.income)}
                </p>
              </div>
              <div>
                <p className="eyebrow">Gastos</p>
                <p className="mono text-[color:var(--color-down)] font-semibold">
                  −{money(summary.data.expense)}
                </p>
              </div>
            </div>
            {summary.data.income > 0 && (
              <div className="mt-4">
                <div className="h-1.5 rounded-full bg-[color:var(--color-surface-2)] overflow-hidden">
                  <div
                    className="h-full"
                    style={{
                      width: `${used}%`,
                      background:
                        "linear-gradient(90deg, var(--color-accent), var(--color-accent-2))",
                    }}
                  />
                </div>
                <p className="mt-2 text-xs text-[color:var(--color-ink-faint)]">
                  {used}% de ingresos consumidos en gastos
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-[color:var(--color-down)]">
            No se pudo cargar el resumen.
          </p>
        )}
      </section>

      {/* By category */}
      {(summary.data?.by_category.length ?? 0) > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[color:var(--color-ink-soft)]">
              Por categoría
            </h2>
            <button
              onClick={() => setCatsOpen(true)}
              className="text-xs text-[color:var(--color-accent)] font-medium"
            >
              Gestionar
            </button>
          </div>
          <div className="card space-y-3">
            {summary.data!.by_category.map((b, i) => (
              <div
                key={`${b.category_id ?? "none"}-${b.kind}-${i}`}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      background:
                        b.kind === "income"
                          ? "var(--color-up)"
                          : "var(--color-down)",
                    }}
                  />
                  <span className="truncate">
                    {b.category_name ?? "Sin categoría"}
                  </span>
                  <span className="pill">{b.count}</span>
                </div>
                <span
                  className={`mono text-sm font-medium ${
                    b.kind === "income"
                      ? "text-[color:var(--color-up)]"
                      : "text-[color:var(--color-down)]"
                  }`}
                >
                  {b.kind === "income" ? "+" : "−"}
                  {money(b.total)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Metas */}
      <GoalsSection />

      {/* New transaction */}
      <section className="mb-6">
        <NewTransactionForm categories={cats.data ?? []} />
      </section>

      {/* Transactions list — header con CTA categorías cuando no hay summary */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[color:var(--color-ink-soft)]">
            Movimientos
          </h2>
          <div className="flex items-center gap-3">
            {(summary.data?.by_category.length ?? 0) === 0 && (
              <button
                onClick={() => setCatsOpen(true)}
                className="text-xs text-[color:var(--color-accent)] font-medium"
              >
                Gestionar categorías
              </button>
            )}
            {txs.data && (
              <span className="text-xs text-[color:var(--color-ink-faint)]">
                {txs.data.length}
              </span>
            )}
          </div>
        </div>

        {txs.isLoading ? (
          <div className="card h-24 animate-pulse" />
        ) : (txs.data ?? []).length === 0 ? (
          <div className="card text-center text-sm text-[color:var(--color-ink-faint)]">
            Sin movimientos este mes — agrega el primero arriba.
          </div>
        ) : (
          <div className="card space-y-1">
            {txs.data!.map((t) => (
              <TransactionItem
                key={t.id}
                tx={t}
                category={t.category_id ? catMap.get(t.category_id) ?? null : null}
              />
            ))}
          </div>
        )}
      </section>

      <CategoriesSheet
        open={catsOpen}
        onClose={() => setCatsOpen(false)}
        categories={cats.data ?? []}
      />
    </main>
  );
}
