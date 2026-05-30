"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { NewRoutineForm } from "./new-routine";
import { RoutineRow } from "./routine-row";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function RutinasPage() {
  const qc = useQueryClient();
  const [date] = useState(today());

  const instances = useQuery({
    queryKey: ["routines", "instances", date],
    queryFn: () => api.routines.instances(date),
  });
  const all = useQuery({
    queryKey: ["routines", "all"],
    queryFn: () => api.routines.list(),
  });

  const markMut = useMutation({
    mutationFn: (input: { routine_id: string; due_on: string; status: "done" | "pending" | "skipped" }) =>
      api.routines.markLog(input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["routines", "instances", date] });
      const prev = qc.getQueryData<typeof instances.data>(["routines", "instances", date]);
      qc.setQueryData<typeof instances.data>(["routines", "instances", date], (old) =>
        old?.map((i) =>
          i.routine.id === input.routine_id
            ? { ...i, status: input.status }
            : i,
        ),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["routines", "instances", date], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["routines"] });
    },
  });

  const data = instances.data ?? [];
  const doneCount = data.filter((i) => i.status === "done").length;
  const total = data.length;
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  // Stroke dasharray para el anillo: circumferencia ≈ 2πr con r=25 → 157.08
  const RING_C = 157.08;
  const dashOffset = RING_C - (RING_C * pct) / 100;

  return (
    <main className="mx-auto max-w-md min-h-dvh px-5 pt-10 pb-32">
      <header className="mb-7">
        <p className="eyebrow mb-1.5">Tus hábitos</p>
        <h1 className="text-5xl font-light" style={{ fontFamily: "var(--font-serif)" }}>
          Rutinas
        </h1>
      </header>

      {/* Ring de cumplimiento de hoy */}
      <section className="card mb-6 flex items-center gap-4">
        <div className="relative w-[72px] h-[72px] flex-shrink-0">
          <svg viewBox="0 0 60 60" className="w-full h-full -rotate-90">
            <circle
              cx="30"
              cy="30"
              r="25"
              fill="none"
              stroke="var(--color-surface-2)"
              strokeWidth="6"
            />
            <circle
              cx="30"
              cy="30"
              r="25"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 400ms ease-out" }}
            />
          </svg>
          <span className="absolute inset-0 grid place-items-center mono text-lg font-semibold">
            {doneCount}/{total}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold">
            {total === 0
              ? "Sin rutinas para hoy"
              : pct === 100
                ? "¡Día completo! 🔥"
                : `${pct}% de cumplimiento`}
          </p>
          <p className="text-xs text-[color:var(--color-ink-faint)] mt-0.5">
            {total === 0
              ? "Crea una rutina abajo para empezar."
              : `${total - doneCount} pendientes`}
          </p>
        </div>
      </section>

      {/* Lista de hoy */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[color:var(--color-ink-soft)]">
            Hoy
          </h2>
          <span className="text-xs text-[color:var(--color-ink-faint)]">
            {new Date().toLocaleDateString("es-CL", {
              weekday: "long",
              day: "numeric",
              month: "short",
            })}
          </span>
        </div>

        {instances.isLoading ? (
          <div className="card h-24 animate-pulse" />
        ) : data.length === 0 ? (
          <div className="card text-center text-sm text-[color:var(--color-ink-faint)]">
            Hoy no toca ninguna rutina activa.
          </div>
        ) : (
          <div className="card space-y-1">
            {data.map((inst) => (
              <RoutineRow
                key={inst.routine.id}
                instance={inst}
                onToggle={(nextStatus) =>
                  markMut.mutate({
                    routine_id: inst.routine.id,
                    due_on: inst.due_on,
                    status: nextStatus,
                  })
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* Crear */}
      <section className="mb-6">
        <NewRoutineForm />
      </section>

      {/* Lista completa (con borrar) */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[color:var(--color-ink-soft)]">
            Todas las rutinas
          </h2>
          {all.data && (
            <span className="text-xs text-[color:var(--color-ink-faint)]">
              {all.data.length}
            </span>
          )}
        </div>
        {all.isLoading ? (
          <div className="card h-20 animate-pulse" />
        ) : (all.data ?? []).length === 0 ? (
          <div className="card text-center text-sm text-[color:var(--color-ink-faint)]">
            Sin rutinas todavía.
          </div>
        ) : (
          <div className="card space-y-2">
            {all.data!.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-1">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{r.title}</p>
                  <p className="text-xs text-[color:var(--color-ink-faint)]">
                    {r.time_of_day} · {humanRrule(r.rrule)} · {r.notify_mode}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm(`¿Borrar "${r.title}"?`)) return;
                    await api.routines.remove(r.id);
                    qc.invalidateQueries({ queryKey: ["routines"] });
                  }}
                  className="text-xs px-2 py-1 rounded-md text-[color:var(--color-down)] hover:bg-[color:var(--color-surface-2)]"
                  aria-label={`Borrar ${r.title}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function humanRrule(rrule: string): string {
  if (rrule.includes("FREQ=DAILY")) return "Diario";
  const mDay = /BYDAY=([A-Z,]+)/.exec(rrule);
  if (mDay) {
    const map: Record<string, string> = {
      MO: "L",
      TU: "M",
      WE: "X",
      TH: "J",
      FR: "V",
      SA: "S",
      SU: "D",
    };
    return (mDay[1] ?? "")
      .split(",")
      .map((d) => map[d] ?? d)
      .join(" ");
  }
  if (rrule.includes("FREQ=WEEKLY")) return "Semanal";
  if (rrule.includes("FREQ=MONTHLY")) return "Mensual";
  return rrule;
}
