"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, api } from "@/lib/api";

type NotifyMode = "notify" | "vibrate" | "silent";

const WEEKDAYS = [
  { code: "MO", label: "L" },
  { code: "TU", label: "M" },
  { code: "WE", label: "X" },
  { code: "TH", label: "J" },
  { code: "FR", label: "V" },
  { code: "SA", label: "S" },
  { code: "SU", label: "D" },
] as const;

export function NewRoutineForm() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("07:00");
  const [mode, setMode] = useState<"daily" | "weekly">("daily");
  const [days, setDays] = useState<string[]>(["MO", "WE", "FR"]);
  const [notify, setNotify] = useState<NotifyMode>("notify");
  const [duration, setDuration] = useState(30);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle("");
    setTime("07:00");
    setMode("daily");
    setDays(["MO", "WE", "FR"]);
    setNotify("notify");
    setDuration(30);
    setError(null);
  };

  const mutation = useMutation({
    mutationFn: () => {
      const rrule =
        mode === "daily"
          ? "FREQ=DAILY"
          : `FREQ=WEEKLY;BYDAY=${days.join(",")}`;
      return api.routines.create({
        title: title.trim(),
        rrule,
        time_of_day: time,
        duration_minutes: duration,
        notify_mode: notify,
        active: true,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routines"] });
      setOpen(false);
      reset();
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError) {
        const body = e.body as { message?: string; issues?: Array<{ message: string }> } | null;
        setError(body?.issues?.map((i) => i.message).join(" · ") ?? body?.message ?? `Error ${e.status}`);
      } else {
        setError("Error inesperado");
      }
    },
  });

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        + Nueva rutina
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (!title.trim()) {
          setError("El título es obligatorio");
          return;
        }
        if (mode === "weekly" && days.length === 0) {
          setError("Elige al menos un día");
          return;
        }
        mutation.mutate();
      }}
      className="card space-y-3"
    >
      <p className="eyebrow">Nueva rutina</p>

      <input
        className="input"
        placeholder="Título (ej: Rutina de mañana)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        autoFocus
      />

      {/* Frecuencia */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("daily")}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
            mode === "daily"
              ? "bg-[color:var(--color-accent)] text-[#1a120a]"
              : "bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-soft)]"
          }`}
        >
          Diario
        </button>
        <button
          type="button"
          onClick={() => setMode("weekly")}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
            mode === "weekly"
              ? "bg-[color:var(--color-accent)] text-[#1a120a]"
              : "bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-soft)]"
          }`}
        >
          Días específicos
        </button>
      </div>

      {mode === "weekly" && (
        <div className="flex gap-1.5 justify-between">
          {WEEKDAYS.map((d) => {
            const on = days.includes(d.code);
            return (
              <button
                key={d.code}
                type="button"
                onClick={() =>
                  setDays((prev) =>
                    on ? prev.filter((x) => x !== d.code) : [...prev, d.code],
                  )
                }
                className={`w-9 h-9 rounded-full text-sm font-medium transition ${
                  on
                    ? "bg-[color:var(--color-accent)] text-[#1a120a]"
                    : "bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-soft)]"
                }`}
                aria-label={d.code}
                aria-pressed={on}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="eyebrow block mb-1.5">Hora</label>
          <input
            type="time"
            className="input mono"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
        <div>
          <label className="eyebrow block mb-1.5">Duración (min)</label>
          <input
            type="number"
            className="input mono"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            min={1}
            max={1440}
          />
        </div>
      </div>

      <div>
        <label className="eyebrow block mb-1.5">Aviso</label>
        <div className="grid grid-cols-3 gap-2">
          {(["notify", "vibrate", "silent"] as NotifyMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setNotify(m)}
              className={`py-2 rounded-xl text-xs font-medium transition ${
                notify === m
                  ? "bg-[color:var(--color-accent-2)] text-[#1a120a]"
                  : "bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-soft)]"
              }`}
            >
              {m === "notify" ? "Notificar" : m === "vibrate" ? "Vibrar" : "Silencio"}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-[color:var(--color-down)]">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          className="flex-1 py-3 rounded-xl bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-soft)] text-sm font-medium"
        >
          Cancelar
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
          {mutation.isPending ? "Creando…" : "Crear"}
        </button>
      </div>
    </form>
  );
}
