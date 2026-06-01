"use client";

import type { RoutineInstance } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

interface Props {
  instance: RoutineInstance;
  onToggle: (userId: string, next: "done" | "pending") => void;
}

const NOTIFY_LABEL: Record<string, string> = {
  notify: "Notificar",
  vibrate: "Vibrar",
  silent: "Silencio",
};

export function RoutineRow({ instance, onToggle }: Props) {
  const me = useAuthStore((s) => s.user);
  const { routine, members } = instance;
  const isShared = members.length > 1;

  // Estado agregado: cuando ambos están done, la rutina se tacha
  const allDone = members.every((m) => m.status === "done");

  return (
    <div className="py-2.5">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p
            className={`font-medium truncate ${
              allDone ? "line-through opacity-60" : ""
            }`}
          >
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

      {/* Checks por miembro */}
      <div
        className={`mt-2 flex gap-2 ${isShared ? "justify-start" : "justify-end"}`}
      >
        {members.map((m) => {
          const isMe = m.user_id === me?.id;
          const done = m.status === "done";
          const skipped = m.status === "skipped";

          return (
            <button
              key={m.user_id}
              type="button"
              disabled={!isMe}
              onClick={() => isMe && onToggle(m.user_id, done ? "pending" : "done")}
              aria-pressed={done}
              aria-label={
                isMe
                  ? done
                    ? `Desmarcar ${routine.title}`
                    : `Marcar ${routine.title} como hecho`
                  : `Estado de ${m.user_name}`
              }
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                isMe ? "active:scale-95 cursor-pointer" : "cursor-default opacity-90"
              } ${
                done
                  ? "bg-[color:var(--color-up)] text-[#0a1a12]"
                  : skipped
                    ? "bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-faint)] line-through"
                    : "bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-soft)] border border-[color:var(--color-line)]"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full grid place-items-center flex-shrink-0 ${
                  done
                    ? "bg-[#0a1a12]/20"
                    : "border border-current"
                }`}
              >
                {done && (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="w-3 h-3"
                    aria-hidden
                  >
                    <path
                      d="M5 12l5 5L20 7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <span>
                {isMe ? "Yo" : m.user_name.split(" ")[0]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
