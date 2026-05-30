"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { MealType } from "@mi-centro/shared";
import { api } from "@/lib/api";
import { DishesSheet } from "./dishes-sheet";
import { NewMealForm } from "./new-meal";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const MEAL_LABELS: Record<MealType, { name: string; emoji: string }> = {
  breakfast: { name: "Desayuno", emoji: "☀️" },
  lunch: { name: "Almuerzo", emoji: "🍽️" },
  dinner: { name: "Cena", emoji: "🌙" },
  snack: { name: "Snack", emoji: "✦" },
};

export default function DietaPage() {
  const qc = useQueryClient();
  const [dishesOpen, setDishesOpen] = useState(false);
  const date = today();

  const meals = useQuery({
    queryKey: ["meal-plans", date],
    queryFn: () => api.mealPlans.list(date),
  });
  const dishes = useQuery({
    queryKey: ["dishes"],
    queryFn: () => api.dishes.list(),
  });
  const shopping = useQuery({
    queryKey: ["shopping-list"],
    queryFn: () => api.mealPlans.shoppingList(),
  });

  const dishMap = new Map((dishes.data ?? []).map((d) => [d.id, d]));

  const toggleStatusMut = useMutation({
    mutationFn: (input: { id: string; status: "planned" | "eaten" | "skipped" }) =>
      api.mealPlans.update(input.id, { status: input.status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meal-plans"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.mealPlans.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meal-plans"] });
      qc.invalidateQueries({ queryKey: ["shopping-list"] });
    },
  });

  return (
    <main className="mx-auto max-w-md min-h-dvh px-5 pt-10 pb-32">
      <header className="mb-7">
        <p className="eyebrow mb-1.5">Plan del día</p>
        <h1 className="text-5xl font-light" style={{ fontFamily: "var(--font-serif)" }}>
          Dieta
        </h1>
      </header>

      {/* Aviso matutino — placeholder */}
      <div className="card mb-6 flex items-center gap-3">
        <span className="w-9 h-9 rounded-full grid place-items-center text-lg flex-shrink-0 bg-[color:var(--color-surface-2)]">
          ✦
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium">Aviso matutino</p>
          <p className="text-xs text-[color:var(--color-ink-faint)]">
            Te recordará qué cocinar a las 08:00 (cuando entre push)
          </p>
        </div>
      </div>

      {/* Comidas de hoy */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[color:var(--color-ink-soft)]">
            Comidas de hoy
          </h2>
          <button
            onClick={() => setDishesOpen(true)}
            className="text-xs text-[color:var(--color-accent)] font-medium"
          >
            Mis platos
          </button>
        </div>

        {meals.isLoading ? (
          <div className="card h-24 animate-pulse" />
        ) : (meals.data ?? []).length === 0 ? (
          <div className="card text-center text-sm text-[color:var(--color-ink-faint)]">
            Sin comidas planeadas para hoy.
          </div>
        ) : (
          <div className="space-y-2">
            {meals.data!.map((m) => {
              const dish = m.dish_id ? dishMap.get(m.dish_id) : null;
              const eaten = m.status === "eaten";
              const meta = MEAL_LABELS[m.meal_type];
              return (
                <div
                  key={m.id}
                  className={`card flex items-stretch gap-3 transition-opacity ${
                    eaten ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex-shrink-0 pr-3 border-r border-[color:var(--color-line)] min-w-[64px]">
                    <p className="mono text-lg font-medium">
                      {m.eat_time ?? "—"}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-[color:var(--color-ink-faint)]">
                      {meta.name}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${eaten ? "line-through" : ""}`}>
                      {dish?.name ?? "Sin plato"} {meta.emoji}
                    </p>
                    <p className="text-xs text-[color:var(--color-ink-faint)] mt-0.5">
                      {m.cook_time
                        ? `Cocinar ${m.cook_time}${dish?.prep_minutes ? ` · ~${dish.prep_minutes} min` : ""}`
                        : "Sin hora de cocción"}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <button
                      type="button"
                      onClick={() =>
                        toggleStatusMut.mutate({
                          id: m.id,
                          status: eaten ? "planned" : "eaten",
                        })
                      }
                      className={`text-[10px] px-2 py-1 rounded-md font-medium ${
                        eaten
                          ? "bg-[color:var(--color-up)] text-[#0a1a12]"
                          : "bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-soft)]"
                      }`}
                      aria-pressed={eaten}
                    >
                      {eaten ? "✓ Comido" : "Marcar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("¿Borrar esta comida?")) deleteMut.mutate(m.id);
                      }}
                      className="text-[10px] px-2 py-1 rounded-md text-[color:var(--color-down)]"
                      aria-label="Borrar"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Crear comida */}
      <section className="mb-6">
        <NewMealForm dishes={dishes.data ?? []} date={date} />
      </section>

      {/* Lista de compras */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[color:var(--color-ink-soft)]">
            Lista de compras
          </h2>
          {shopping.data && (
            <span className="text-xs text-[color:var(--color-ink-faint)]">
              {shopping.data.from} → {shopping.data.to}
            </span>
          )}
        </div>
        {shopping.isLoading ? (
          <div className="card h-20 animate-pulse" />
        ) : (shopping.data?.items.length ?? 0) === 0 ? (
          <div className="card text-center text-sm text-[color:var(--color-ink-faint)]">
            Planea comidas con platos que tengan ingredientes para llenar tu lista.
          </div>
        ) : (
          <div className="card space-y-2">
            {shopping.data!.items.map((it) => (
              <div key={it.name} className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-accent)] flex-shrink-0 mt-2" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">
                    {it.name}
                    {it.quantity && (
                      <span className="ml-2 text-xs text-[color:var(--color-ink-soft)] mono">
                        {it.quantity}
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-[color:var(--color-ink-faint)] truncate">
                    {it.dishes.join(", ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <DishesSheet
        open={dishesOpen}
        onClose={() => setDishesOpen(false)}
        dishes={dishes.data ?? []}
      />
    </main>
  );
}
