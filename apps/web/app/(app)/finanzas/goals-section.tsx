"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FinancialGoal } from "@mi-centro/shared";
import { ApiError, api } from "@/lib/api";
import { money } from "@/lib/format";

export function GoalsSection() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [contributingTo, setContributingTo] = useState<FinancialGoal | null>(null);

  const goals = useQuery({
    queryKey: ["goals"],
    queryFn: () => api.goals.list(),
  });

  const activeGoals = (goals.data ?? []).filter((g) => g.status === "active");

  const contributionsByGoal = useQueries({
    queries: activeGoals.map((g) => ({
      queryKey: ["goals", g.id, "contributions"],
      queryFn: () => api.goals.listContributions(g.id),
      enabled: !!g.id,
    })),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["goals"] });
  };

  if (goals.isLoading) {
    return (
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-[color:var(--color-ink-soft)] mb-3">
          Metas
        </h2>
        <div className="card h-24 animate-pulse" />
      </section>
    );
  }

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[color:var(--color-ink-soft)]">
          Metas
        </h2>
        <button
          onClick={() => setCreating(true)}
          className="text-xs text-[color:var(--color-accent)] font-medium"
        >
          + Nueva
        </button>
      </div>

      {activeGoals.length === 0 && !creating ? (
        <div className="card text-center text-sm text-[color:var(--color-ink-faint)]">
          Sin metas activas. Crea una para empezar a ahorrar.
        </div>
      ) : (
        <div className="space-y-3">
          {activeGoals.map((goal, i) => {
            const contribs = contributionsByGoal[i]?.data ?? [];
            const current = contribs.reduce((s, c) => s + c.amount, 0);
            const pct = Math.min(
              100,
              Math.round((current / Math.max(1, goal.target_amount)) * 100),
            );
            return (
              <div key={goal.id} className="card">
                <div className="flex items-center justify-between mb-2">
                  <b className="truncate">{goal.name}</b>
                  <span className="mono text-sm font-semibold text-[color:var(--color-accent)]">
                    {pct}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[color:var(--color-surface-2)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background:
                        "linear-gradient(90deg, var(--color-accent), var(--color-accent-2))",
                    }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-[color:var(--color-ink-faint)] truncate">
                    {money(current)} / {money(goal.target_amount)}
                    {goal.target_date && (
                      <span className="ml-2">
                        · meta: {new Date(`${goal.target_date}T00:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    )}
                  </p>
                  <button
                    onClick={() => setContributingTo(goal)}
                    className="text-[10px] px-2 py-1 rounded-md bg-[color:var(--color-surface-2)] text-[color:var(--color-accent)] font-medium flex-shrink-0"
                  >
                    + Aporte
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {creating && <CreateGoalForm onClose={() => setCreating(false)} onSaved={invalidate} />}
      {contributingTo && (
        <AddContributionForm
          goal={contributingTo}
          onClose={() => setContributingTo(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["goals", contributingTo.id, "contributions"] });
          }}
        />
      )}
    </section>
  );
}

function CreateGoalForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () =>
      api.goals.create({
        name: name.trim(),
        target_amount: Number(amount),
        currency: "CLP",
        target_date: date || null,
        status: "active",
      }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (e: unknown) => setError(toMessage(e)),
  });

  return (
    <Sheet title="Nueva meta" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (!name.trim() || Number(amount) <= 0) {
            setError("Nombre y monto válido requeridos");
            return;
          }
          mut.mutate();
        }}
        className="space-y-3"
      >
        <input
          className="input"
          placeholder="Nombre (ej: Viaje al sur)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          autoFocus
        />
        <input
          className="input mono"
          type="number"
          inputMode="decimal"
          placeholder="Monto objetivo"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min={1}
        />
        <div>
          <label className="eyebrow block mb-1.5">Fecha objetivo (opcional)</label>
          <input
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-[color:var(--color-down)]">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-soft)] text-sm font-medium"
          >
            Cancelar
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={mut.isPending}>
            {mut.isPending ? "Creando…" : "Crear meta"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function AddContributionForm({
  goal,
  onClose,
  onSaved,
}: {
  goal: FinancialGoal;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () =>
      api.goals.addContribution(goal.id, {
        amount: Number(amount),
        occurred_on: date,
        note: note || null,
      }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (e: unknown) => setError(toMessage(e)),
  });

  return (
    <Sheet title={`Aporte a "${goal.name}"`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (Number(amount) <= 0) {
            setError("Monto inválido");
            return;
          }
          mut.mutate();
        }}
        className="space-y-3"
      >
        <input
          className="input mono text-2xl"
          type="number"
          inputMode="decimal"
          placeholder="Monto"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min={1}
          autoFocus
        />
        <input
          className="input"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <input
          className="input"
          placeholder="Nota (opcional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={120}
        />
        {error && <p className="text-sm text-[color:var(--color-down)]">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-soft)] text-sm font-medium"
          >
            Cancelar
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={mut.isPending}>
            {mut.isPending ? "Guardando…" : "Aportar"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl border-t border-[color:var(--color-line)] bg-[color:var(--color-bg)] px-5 pt-3 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-[color:var(--color-line)]" />
        <header className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-light" style={{ fontFamily: "var(--font-serif)" }}>
            {title}
          </h2>
          <button onClick={onClose} className="pill">
            Cerrar
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function toMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as { message?: string; issues?: Array<{ message: string }> } | null;
    if (body?.issues?.length) return body.issues.map((i) => i.message).join(" · ");
    if (body?.message) return body.message;
    return `Error ${e.status}`;
  }
  return e instanceof Error ? e.message : "Error inesperado";
}
