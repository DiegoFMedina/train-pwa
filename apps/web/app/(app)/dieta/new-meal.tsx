"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Dish, MealType } from "@mi-centro/shared";
import { ApiError, api } from "@/lib/api";

const MEAL_TYPES: Array<{ code: MealType; label: string }> = [
  { code: "breakfast", label: "Desayuno" },
  { code: "lunch", label: "Almuerzo" },
  { code: "dinner", label: "Cena" },
  { code: "snack", label: "Snack" },
];

export function NewMealForm({ dishes, date }: { dishes: Dish[]; date: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dishId, setDishId] = useState<string>("");
  const [mealType, setMealType] = useState<MealType>("lunch");
  const [cookTime, setCookTime] = useState("");
  const [eatTime, setEatTime] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setDishId("");
    setMealType("lunch");
    setCookTime("");
    setEatTime("");
    setError(null);
  };

  const mutation = useMutation({
    mutationFn: () =>
      api.mealPlans.create({
        dish_id: dishId || undefined,
        plan_date: date,
        meal_type: mealType,
        cook_time: cookTime || undefined,
        eat_time: eatTime || undefined,
        notify_mode: "notify",
        status: "planned",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meal-plans"] });
      qc.invalidateQueries({ queryKey: ["shopping-list"] });
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
        + Planear comida
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        mutation.mutate();
      }}
      className="card space-y-3"
    >
      <p className="eyebrow">Nueva comida</p>

      <div className="grid grid-cols-2 gap-2">
        {MEAL_TYPES.map((m) => (
          <button
            key={m.code}
            type="button"
            onClick={() => setMealType(m.code)}
            className={`py-2 rounded-xl text-sm font-medium transition ${
              mealType === m.code
                ? "bg-[color:var(--color-rose)] text-[#1a120a]"
                : "bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-soft)]"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div>
        <label className="eyebrow block mb-1.5">Plato</label>
        <select
          className="input"
          value={dishId}
          onChange={(e) => setDishId(e.target.value)}
        >
          <option value="">Sin plato (solo recordatorio)</option>
          {dishes.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
              {d.prep_minutes ? ` · ${d.prep_minutes} min` : ""}
            </option>
          ))}
        </select>
        {dishes.length === 0 && (
          <p className="text-xs text-[color:var(--color-ink-faint)] mt-1">
            Aún no tienes platos. Crea uno desde "Mis platos".
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="eyebrow block mb-1.5">Cocinar</label>
          <input
            type="time"
            className="input mono"
            value={cookTime}
            onChange={(e) => setCookTime(e.target.value)}
          />
        </div>
        <div>
          <label className="eyebrow block mb-1.5">Comer</label>
          <input
            type="time"
            className="input mono"
            value={eatTime}
            onChange={(e) => setEatTime(e.target.value)}
          />
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
          {mutation.isPending ? "Guardando…" : "Planear"}
        </button>
      </div>
    </form>
  );
}
