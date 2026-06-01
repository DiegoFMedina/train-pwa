"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api, type RoutineInstance } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useScopeStore } from "@/lib/scope-store";
import { NewRoutineForm } from "./new-routine";
import { RoutineRow } from "./routine-row";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function RutinasPage() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const scope = useScopeStore((s) => s.scope);
  const isCouple = scope === "couple";
  const [date] = useState(today());

  const instances = useQuery({
    queryKey: ["routines", "instances", date, scope],
    queryFn: () => api.routines.instances(date),
  });
  const all = useQuery({
    queryKey: ["routines", "all", scope],
    queryFn: () => api.routines.list(),
  });

  const markMut = useMutation({
    mutationFn: (input: { routine_id: string; due_on: string; status: "done" | "pending" | "skipped" }) =>
      api.routines.markLog(input),
    onMutate: async (input) => {
      const key = ["routines", "instances", date, scope];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<RoutineInstance[]>(key);
      qc.setQueryData<RoutineInstance[]>(key, (old) =>
        old?.map((i) =>
          i.routine.id === input.routine_id
            ? {
                ...i,
                members: i.members.map((m) =>
                  m.user_id === me?.id ? { ...m, status: input.status } : m,
                ),
              }
            : i,
        ),
      );
      return { prev, key };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev && ctx?.key) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["routines"] });
    },
  });

  const data = instances.data ?? [];

  // Para el ring: porcentaje del usuario actual (lo que importa visualmente)
  const myProgress = useMemo(() => {
    let done = 0;
    let total = 0;
    for (const inst of data) {
      const mine = inst.members.find((m) => m.user_id === me?.id);
      if (!mine) continue;
      total++;
      if (mine.status === "done") done++;
    }
    return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
  }, [data, me]);

  // En couple: progreso del partner
  const partnerProgress = useMemo(() => {
    if (!isCouple) return null;
    let done = 0;
    let total = 0;
    let partnerName = "";
    for (const inst of data) {
      const partner = inst.members.find((m) => m.user_id !== me?.id);
      if (!partner) continue;
      partnerName = partner.user_name;
      total++;
      if (partner.status === "done") done++;
    }
    return {
      name: partnerName,
      done,
      total,
      pct: total === 0 ? 0 : Math.round((done / total) * 100),
    };
  }, [data, me, isCouple]);

  const RING_C = 157.08;

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-32">
      <header className="mb-7">
        <p className="eyebrow mb-1.5">
          {isCouple ? "Hábitos compartidos" : "Tus hábitos"}
        </p>
        <h1
          className="text-5xl font-light"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Rutinas
        </h1>
      </header>

      {/* Ring(s) de cumplimiento */}
      <section className="card mb-6">
        <div
          className={`flex items-center gap-4 ${
            isCouple && partnerProgress ? "justify-around" : ""
          }`}
        >
          <ProgressRing
            done={myProgress.done}
            total={myProgress.total}
            pct={myProgress.pct}
            color="var(--color-accent)"
            label="Yo"
            ringC={RING_C}
          />
          {isCouple && partnerProgress && partnerProgress.total > 0 && (
            <ProgressRing
              done={partnerProgress.done}
              total={partnerProgress.total}
              pct={partnerProgress.pct}
              color="var(--color-jade)"
              label={partnerProgress.name.split(" ")[0] ?? "Pareja"}
              ringC={RING_C}
            />
          )}
        </div>
        {!isCouple && myProgress.total > 0 && (
          <p className="text-center text-xs text-[color:var(--color-ink-faint)] mt-3">
            {myProgress.pct === 100
              ? "¡Día completo! 🔥"
              : `${myProgress.total - myProgress.done} pendientes`}
          </p>
        )}
        {isCouple && myProgress.pct === 100 && partnerProgress?.pct === 100 && (
          <p className="text-center text-xs text-[color:var(--color-up)] font-semibold mt-3">
            ¡Día completo juntos! 🔥
          </p>
        )}
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
          <div className="card text-center text-sm text-[color:var(--color-ink-faint)] py-8">
            {isCouple
              ? "Sin rutinas compartidas para hoy. Crea una abajo."
              : "Hoy no toca ninguna rutina activa."}
          </div>
        ) : (
          <div className="card divide-y divide-[color:var(--color-line)]">
            {data.map((inst) => (
              <RoutineRow
                key={inst.routine.id}
                instance={inst}
                onToggle={(_userId, nextStatus) =>
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
            {isCouple ? "Rutinas compartidas" : "Todas las rutinas"}
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
            {isCouple
              ? "Sin rutinas compartidas todavía."
              : "Sin rutinas todavía."}
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

function ProgressRing({
  done,
  total,
  pct,
  color,
  label,
  ringC,
}: {
  done: number;
  total: number;
  pct: number;
  color: string;
  label: string;
  ringC: number;
}) {
  const dashOffset = ringC - (ringC * pct) / 100;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-[80px] h-[80px]">
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
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={ringC}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 500ms ease-out" }}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center mono text-base font-semibold">
          {done}/{total}
        </span>
      </div>
      <span
        className="text-[11px] uppercase tracking-wider font-semibold"
        style={{ color }}
      >
        {label}
      </span>
    </div>
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
