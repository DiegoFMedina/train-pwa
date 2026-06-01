"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Dish, MealPlan, MealType } from "@mi-centro/shared";
import { ApiError, api, type DishSuggestion } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { fullDateFromYmd } from "@/lib/dates";
import { useScopeStore } from "@/lib/scope-store";
import { MEAL_META, MEAL_ORDER } from "./meal-meta";

interface Props {
  ymd: string;
  plans: MealPlan[];
  dishes: Dish[];
  onClose: () => void;
}

export function DayPlannerSheet({ ymd, plans, dishes, onClose }: Props) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const scope = useScopeStore((s) => s.scope);
  const isCouple = scope === "couple";
  const [expandedMeal, setExpandedMeal] = useState<MealType | null>(null);

  const dishMap = new Map(dishes.map((d) => [d.id, d]));

  // Agrupar plans por meal_type → array de plans (1+ por meal_type en couple)
  const plansByMeal = new Map<MealType, MealPlan[]>();
  for (const p of plans) {
    const arr = plansByMeal.get(p.meal_type) ?? [];
    arr.push(p);
    plansByMeal.set(p.meal_type, arr);
  }

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["meal-plans"] });
    qc.invalidateQueries({ queryKey: ["shopping-list"] });
    qc.invalidateQueries({ queryKey: ["dish-suggestions"] });
  };

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
      />

      <div className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-[28px] border-t border-[color:var(--color-line)] bg-[color:var(--color-bg)]/95 backdrop-blur-2xl px-5 pt-3 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-[color:var(--color-line)]" />

        <header className="mb-5">
          <p className="eyebrow mb-1">
            {isCouple ? "Planificar día · compartido" : "Planificar día"}
          </p>
          <h2 className="title-display text-3xl capitalize">
            {fullDateFromYmd(ymd)}
          </h2>
        </header>

        <div className="space-y-3">
          {MEAL_ORDER.map((mt) => {
            const meta = MEAL_META[mt];
            const slotPlans = plansByMeal.get(mt) ?? [];
            const myPlan = slotPlans.find((p) => p.user_id === me?.id) ?? null;
            const partnerPlans = isCouple
              ? slotPlans.filter((p) => p.user_id !== me?.id)
              : [];
            const expanded = expandedMeal === mt;

            return (
              <MealSlot
                key={mt}
                mealType={mt}
                ymd={ymd}
                myPlan={myPlan}
                partnerPlans={partnerPlans}
                dishMap={dishMap}
                color={meta.color}
                label={meta.label}
                emoji={meta.emoji}
                isCouple={isCouple}
                expanded={expanded}
                onToggle={() => setExpandedMeal(expanded ? null : mt)}
                onChange={invalidateAll}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface MealSlotProps {
  mealType: MealType;
  ymd: string;
  myPlan: MealPlan | null;
  partnerPlans: MealPlan[];
  dishMap: Map<string, Dish>;
  color: string;
  label: string;
  emoji: string;
  isCouple: boolean;
  expanded: boolean;
  onToggle: () => void;
  onChange: () => void;
}

function MealSlot({
  mealType,
  ymd,
  myPlan,
  partnerPlans,
  dishMap,
  color,
  label,
  emoji,
  isCouple,
  expanded,
  onToggle,
  onChange,
}: MealSlotProps) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const suggestions = useQuery({
    queryKey: ["dish-suggestions", mealType, ymd],
    queryFn: () => api.dishes.suggestions(mealType, ymd),
    enabled: expanded && !myPlan,
  });

  const assignMut = useMutation({
    mutationFn: (dishId: string) =>
      myPlan
        ? api.mealPlans.update(myPlan.id, { dish_id: dishId })
        : api.mealPlans.create({
            dish_id: dishId,
            plan_date: ymd,
            meal_type: mealType,
            notify_mode: "notify",
            status: "planned",
          }),
    onSuccess: () => {
      onChange();
      setError(null);
    },
    onError: (e: unknown) => setError(toMessage(e)),
  });

  const toggleEatenMut = useMutation({
    mutationFn: () => {
      if (!myPlan) throw new Error("Sin plan");
      return api.mealPlans.update(myPlan.id, {
        status: myPlan.status === "eaten" ? "planned" : "eaten",
      });
    },
    onSuccess: onChange,
  });

  const deleteMut = useMutation({
    mutationFn: () => {
      if (!myPlan) throw new Error("Sin plan");
      return api.mealPlans.remove(myPlan.id);
    },
    onSuccess: () => {
      onChange();
      qc.invalidateQueries({ queryKey: ["meal-plans"] });
    },
  });

  const myDish = myPlan?.dish_id ? dishMap.get(myPlan.dish_id) : null;
  const eaten = myPlan?.status === "eaten";

  return (
    <div className="card !p-0 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <span
          className="w-9 h-9 rounded-2xl grid place-items-center text-base flex-shrink-0"
          style={{
            background: `color-mix(in oklab, ${color} 18%, transparent)`,
            color,
          }}
        >
          {emoji}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-ink-faint)]">
            {label}
          </p>
          {/* Mi plan (línea principal) */}
          <p
            className={`font-medium truncate ${
              eaten ? "line-through opacity-60" : ""
            }`}
          >
            {myDish?.name ?? (
              <span className="text-[color:var(--color-ink-faint)] italic">
                {isCouple && partnerPlans.length > 0
                  ? "Sin asignar (tú)"
                  : "Sin plato"}
              </span>
            )}
          </p>
          {/* Plans del partner (en couple) */}
          {isCouple &&
            partnerPlans.map((pp) => {
              const ppDish = pp.dish_id ? dishMap.get(pp.dish_id) : null;
              const ppEaten = pp.status === "eaten";
              return (
                <p
                  key={pp.id}
                  className={`text-xs mt-0.5 truncate ${
                    ppEaten ? "line-through opacity-50" : ""
                  }`}
                  style={{ color: "var(--color-jade)" }}
                >
                  <span className="opacity-70">
                    {pp.user_name?.split(" ")[0] ?? "Pareja"}:
                  </span>{" "}
                  {ppDish?.name ?? "sin plato"}
                </p>
              );
            })}
        </div>
        <span
          className="text-[color:var(--color-ink-faint)] text-xs transition-transform"
          style={{ transform: expanded ? "rotate(90deg)" : "none" }}
          aria-hidden
        >
          ›
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-[color:var(--color-line)] pt-3 space-y-3">
          {myPlan && (
            <div className="flex gap-2">
              <button
                onClick={() => toggleEatenMut.mutate()}
                className={`flex-1 py-2 rounded-xl text-xs font-medium transition ${
                  eaten
                    ? "bg-[color:var(--color-up)] text-[#0a1a12]"
                    : "bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-soft)]"
                }`}
              >
                {eaten ? "✓ Comido" : "Marcar comido"}
              </button>
              <button
                onClick={() => {
                  if (confirm(`¿Quitar ${label.toLowerCase()}?`)) deleteMut.mutate();
                }}
                className="px-3 py-2 rounded-xl text-xs text-[color:var(--color-down)]"
              >
                Quitar
              </button>
            </div>
          )}

          {!myPlan && (
            <>
              <p className="text-[10px] text-[color:var(--color-ink-faint)] uppercase tracking-wider">
                Elegir plato {isCouple && "(para ti)"}
              </p>
              {suggestions.isLoading ? (
                <div className="h-20 animate-pulse rounded-xl bg-[color:var(--color-surface-2)]" />
              ) : (suggestions.data ?? []).length === 0 ? (
                <p className="text-xs text-[color:var(--color-ink-faint)]">
                  No tienes platos en este modo. Crea uno desde "Mi catálogo".
                </p>
              ) : (
                <SuggestionsList
                  suggestions={suggestions.data!}
                  onPick={(id) => assignMut.mutate(id)}
                  disabled={assignMut.isPending}
                />
              )}
              {error && <p className="text-xs text-[color:var(--color-down)]">{error}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SuggestionsList({
  suggestions,
  onPick,
  disabled,
}: {
  suggestions: DishSuggestion[];
  onPick: (id: string) => void;
  disabled: boolean;
}) {
  const groups: Array<{ title: string; bucket: DishSuggestion["bucket"]; hint: string }> = [
    { title: "Hace tiempo no comes esto", bucket: "stale", hint: "Para variar" },
    { title: "Sin estrenar", bucket: "never", hint: "Tus nuevos platos" },
    { title: "Tus favoritos", bucket: "favorite", hint: "Más planeados últimos 30 días" },
    { title: "Recientes", bucket: "recent", hint: "Si quieres repetir" },
  ];

  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const items = suggestions.filter((s) => s.bucket === g.bucket);
        if (items.length === 0) return null;
        return (
          <div key={g.bucket}>
            <div className="flex items-baseline justify-between mb-1.5">
              <p className="text-[11px] font-semibold text-[color:var(--color-ink-soft)]">
                {g.title}
              </p>
              <p className="text-[10px] text-[color:var(--color-ink-faint)]">{g.hint}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {items.map((s) => (
                <button
                  key={s.dish.id}
                  type="button"
                  onClick={() => onPick(s.dish.id)}
                  disabled={disabled}
                  className="px-3 py-1.5 rounded-full bg-[color:var(--color-surface-2)] hover:bg-[color:var(--color-surface)] text-xs font-medium border border-[color:var(--color-line)] transition disabled:opacity-50"
                >
                  {s.dish.name}
                  {s.uses_total > 0 && (
                    <span className="ml-1.5 text-[10px] text-[color:var(--color-ink-faint)]">
                      ·{s.uses_total}×
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      })}
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
