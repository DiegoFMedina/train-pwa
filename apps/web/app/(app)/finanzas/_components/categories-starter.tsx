"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";

interface SeedCategory {
  name: string;
  kind: "income" | "expense";
}

// Categorías típicas en Chile. Elegidas por uso real, no exhaustivas.
const SEEDS: SeedCategory[] = [
  { name: "Sueldo", kind: "income" },
  { name: "Otros ingresos", kind: "income" },
  { name: "Supermercado", kind: "expense" },
  { name: "Arriendo", kind: "expense" },
  { name: "Cuentas", kind: "expense" },
  { name: "Transporte", kind: "expense" },
  { name: "Salidas", kind: "expense" },
  { name: "Salud", kind: "expense" },
  { name: "Ropa", kind: "expense" },
  { name: "Suscripciones", kind: "expense" },
];

/**
 * Empty state inteligente: cuando el user no tiene categorías ni transactions,
 * le ofrece crear varias de un toque. Chips toggle con default razonable.
 */
export function CategoriesStarter({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(
    new Set(["Sueldo", "Supermercado", "Arriendo", "Cuentas"]),
  );

  const createMut = useMutation({
    mutationFn: async () => {
      const toCreate = SEEDS.filter((s) => selected.has(s.name));
      // Crear secuencialmente para que el orden quede predecible
      for (const c of toCreate) {
        await api.categories.create({ name: c.name, kind: c.kind });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      onDone();
    },
  });

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="card-feature space-y-4">
      <div>
        <p className="eyebrow mb-1">Empieza fuerte</p>
        <h2 className="title-display text-2xl">
          Crea tus <span className="gradient-text">categorías</span>
        </h2>
        <p className="text-xs text-[color:var(--color-ink-soft)] mt-2">
          Elige las que uses. Las puedes editar o agregar más después.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SEEDS.map((s) => {
          const on = selected.has(s.name);
          const isIncome = s.kind === "income";
          return (
            <button
              key={s.name}
              type="button"
              onClick={() => toggle(s.name)}
              aria-pressed={on}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                on
                  ? isIncome
                    ? "border-[color:var(--color-up)] bg-[color:var(--color-up)]/15 text-[color:var(--color-up)]"
                    : "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/15 text-[color:var(--color-accent)]"
                  : "border-[color:var(--color-line)] text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-surface-2)]"
              }`}
            >
              {isIncome ? "+" : ""}
              {s.name}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-xs text-[color:var(--color-ink-faint)]">
          {selected.size} seleccionada{selected.size === 1 ? "" : "s"}
        </p>
        <button
          onClick={() => createMut.mutate()}
          disabled={selected.size === 0 || createMut.isPending}
          className="btn-primary !w-auto px-5"
        >
          {createMut.isPending
            ? "Creando…"
            : `Crear ${selected.size} categoría${selected.size === 1 ? "" : "s"}`}
        </button>
      </div>
    </div>
  );
}
