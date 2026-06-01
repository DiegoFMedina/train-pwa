"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useScopeStore } from "@/lib/scope-store";

/**
 * Switcher Personal / Compartido. Integrado en el AppHeader sticky.
 * Solo se renderiza si el user tiene una pareja vinculada.
 */
export function ScopeSwitcher() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const scope = useScopeStore((s) => s.scope);
  const setScope = useScopeStore((s) => s.setScope);
  const setHasCouple = useScopeStore((s) => s.setHasCouple);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const couple = useQuery({
    queryKey: ["couples", "me"],
    queryFn: () => api.couples.me(),
    staleTime: 30_000,
  });

  useEffect(() => {
    setHasCouple(!!couple.data);
  }, [couple.data, setHasCouple]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  if (!me) return null;
  if (!couple.data) return null;

  const isCouple = scope === "couple";
  const partner = couple.data.members.find((m) => m.user_id !== me.id);
  const coupleLabel = partner
    ? `Con ${partner.user_name.split(" ")[0]}`
    : couple.data.name;

  const select = (next: "personal" | "couple") => {
    if (next !== scope) {
      setScope(next);
      // Cualquier dato con scope-awareness debe refetch
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["recurring"] });
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      qc.invalidateQueries({ queryKey: ["routines"] });
      qc.invalidateQueries({ queryKey: ["dishes"] });
      qc.invalidateQueries({ queryKey: ["meal-plans"] });
      qc.invalidateQueries({ queryKey: ["shopping-list"] });
      qc.invalidateQueries({ queryKey: ["dish-suggestions"] });
    }
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors active:scale-95"
        style={{
          background: "color-mix(in oklab, var(--color-bg) 60%, transparent)",
          borderColor: isCouple
            ? "color-mix(in oklab, var(--color-jade) 40%, transparent)"
            : "color-mix(in oklab, var(--color-accent) 35%, transparent)",
          color: isCouple ? "var(--color-jade)" : "var(--color-accent)",
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: isCouple ? "var(--color-jade)" : "var(--color-accent)",
          }}
        />
        <span className="font-semibold tracking-wide truncate max-w-[120px]">
          {isCouple ? coupleLabel : "Personal"}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={`w-3 h-3 transition-transform flex-shrink-0 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute top-[calc(100%+8px)] left-0 min-w-[240px] rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-bg)]/95 backdrop-blur-2xl p-2 shadow-2xl"
          style={{ boxShadow: "0 24px 60px -20px rgba(0,0,0,0.8)" }}
        >
          <ScopeOption
            active={!isCouple}
            label="Personal"
            sub="Solo tú lo ves"
            color="var(--color-accent)"
            onSelect={() => select("personal")}
          />
          <ScopeOption
            active={isCouple}
            label={coupleLabel}
            sub="Gestionan juntos"
            color="var(--color-jade)"
            onSelect={() => select("couple")}
          />
        </div>
      )}
    </div>
  );
}

function ScopeOption({
  active,
  label,
  sub,
  color,
  onSelect,
}: {
  active: boolean;
  label: string;
  sub: string;
  color: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      role="option"
      aria-selected={active}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition ${
        active
          ? "bg-[color:var(--color-surface-2)]"
          : "hover:bg-[color:var(--color-surface)]"
      }`}
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: color }}
      />
      <div className="flex-1 min-w-0">
        <p
          className="font-semibold truncate"
          style={{ color: active ? color : "var(--color-ink)" }}
        >
          {label}
        </p>
        <p className="text-[10px] text-[color:var(--color-ink-faint)]">{sub}</p>
      </div>
      {active && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="3"
          className="w-4 h-4 flex-shrink-0"
          aria-hidden
        >
          <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
