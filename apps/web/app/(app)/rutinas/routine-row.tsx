"use client";

import type { RoutineInstance } from "@/lib/api";

interface Props {
  instance: RoutineInstance;
  onToggle: (next: "done" | "pending") => void;
}

const NOTIFY_LABEL: Record<string, string> = {
  notify: "Notificar",
  vibrate: "Vibrar",
  silent: "Silencio",
};

export function RoutineRow({ instance, onToggle }: Props) {
  const { routine, status } = instance;
  const done = status === "done";

  return (
    <div className="flex items-center gap-3 py-2">
      <button
        type="button"
        onClick={() => onToggle(done ? "pending" : "done")}
        aria-pressed={done}
        aria-label={done ? `Desmarcar ${routine.title}` : `Marcar ${routine.title} como hecho`}
        className={`w-7 h-7 rounded-full border-2 grid place-items-center flex-shrink-0 transition-all ${
          done
            ? "border-[color:var(--color-up)] bg-[color:var(--color-up)] text-[#0a1a12]"
            : "border-[color:var(--color-line)] hover:border-[color:var(--color-accent)]"
        }`}
      >
        {done && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-4 h-4">
            <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate ${done ? "line-through opacity-60" : ""}`}>
          {routine.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-[color:var(--color-ink-faint)]">
            {NOTIFY_LABEL[routine.notify_mode] ?? routine.notify_mode}
          </span>
          {routine.duration_minutes && (
            <span className="text-[10px] text-[color:var(--color-ink-faint)]">
              · {routine.duration_minutes} min
            </span>
          )}
        </div>
      </div>

      <span className="mono text-sm text-[color:var(--color-ink-soft)] font-medium">
        {routine.time_of_day}
      </span>
    </div>
  );
}
