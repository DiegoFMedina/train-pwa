"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { MealPlan } from "@mi-centro/shared";
import { api } from "@/lib/api";
import {
  addDays,
  monthLabel,
  monthRange,
  parseYmd,
  todayYmd,
  weekRangeContaining,
} from "@/lib/dates";
import { formatQuantityWithUnit } from "@/lib/quantity";
import { DayPlannerSheet } from "./_components/day-planner-sheet";
import { MonthCalendar } from "./_components/month-calendar";
import { DishesSheet } from "./dishes-sheet";

type ShoppingTab = "week" | "month";

export default function DietaPage() {
  const today = todayYmd();
  const todayDate = parseYmd(today);
  const [year, setYear] = useState(todayDate.getUTCFullYear());
  const [month0, setMonth0] = useState(todayDate.getUTCMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dishesOpen, setDishesOpen] = useState(false);
  const [shoppingTab, setShoppingTab] = useState<ShoppingTab>("week");

  const range = useMemo(() => monthRange(year, month0), [year, month0]);

  const plansQ = useQuery({
    queryKey: ["meal-plans", "range", range.from, range.to],
    queryFn: () => api.mealPlans.listInRange(range.from, range.to),
  });

  const dishesQ = useQuery({
    queryKey: ["dishes"],
    queryFn: () => api.dishes.list(),
  });

  const shoppingRange = useMemo(() => {
    if (shoppingTab === "week") return weekRangeContaining(today);
    return range;
  }, [shoppingTab, today, range]);

  const shoppingQ = useQuery({
    queryKey: ["shopping-list", shoppingRange.from, shoppingRange.to],
    queryFn: () => api.mealPlans.shoppingList(shoppingRange.from, shoppingRange.to),
  });

  const plansByDay = useMemo(() => {
    const m = new Map<string, MealPlan[]>();
    for (const p of plansQ.data ?? []) {
      const arr = m.get(p.plan_date) ?? [];
      arr.push(p);
      m.set(p.plan_date, arr);
    }
    return m;
  }, [plansQ.data]);

  const monthStats = useMemo(() => {
    const plans = plansQ.data ?? [];
    const planned = plans.length;
    const eaten = plans.filter((p) => p.status === "eaten").length;
    const distinctDays = new Set(plans.map((p) => p.plan_date)).size;
    return { planned, eaten, distinctDays };
  }, [plansQ.data]);

  const nav = (delta: number) => {
    let nm = month0 + delta;
    let ny = year;
    if (nm < 0) {
      nm = 11;
      ny -= 1;
    } else if (nm > 11) {
      nm = 0;
      ny += 1;
    }
    setMonth0(nm);
    setYear(ny);
  };

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-32">
      {/* Header */}
      <header className="mb-6">
        <p className="eyebrow mb-1.5">Tu mes en comidas</p>
        <h1 className="title-display text-5xl">
          <span className="gradient-text">Dieta</span>
        </h1>
      </header>

      {/* Navegador de mes */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => nav(-1)}
          aria-label="Mes anterior"
          className="w-10 h-10 rounded-full grid place-items-center bg-[color:var(--color-surface)] hover:bg-[color:var(--color-surface-2)] border border-[color:var(--color-line)] transition active:scale-90"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold capitalize">
          {monthLabel(year, month0)}
        </h2>
        <button
          onClick={() => nav(1)}
          aria-label="Mes siguiente"
          className="w-10 h-10 rounded-full grid place-items-center bg-[color:var(--color-surface)] hover:bg-[color:var(--color-surface-2)] border border-[color:var(--color-line)] transition active:scale-90"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Calendario */}
      <section className="card mb-3">
        {plansQ.isLoading ? (
          <div className="h-72 animate-pulse rounded-xl bg-[color:var(--color-surface-2)]" />
        ) : (
          <MonthCalendar
            year={year}
            month0={month0}
            plansByDay={plansByDay}
            selectedYmd={selectedDay}
            onSelect={setSelectedDay}
          />
        )}
      </section>

      {/* Stats del mes (bento) */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        <Stat label="Planeadas" value={monthStats.planned} />
        <Stat label="Comidas" value={monthStats.eaten} accent="up" />
        <Stat label="Días" value={monthStats.distinctDays} />
      </div>

      {/* Lista de compras */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[color:var(--color-ink-soft)]">
            Lista de compras
          </h2>
          <div className="flex gap-1 p-0.5 rounded-full bg-[color:var(--color-surface-2)]">
            <TabButton active={shoppingTab === "week"} onClick={() => setShoppingTab("week")}>
              Semana
            </TabButton>
            <TabButton active={shoppingTab === "month"} onClick={() => setShoppingTab("month")}>
              Mes
            </TabButton>
          </div>
        </div>

        <p className="text-[10px] text-[color:var(--color-ink-faint)] mb-2 mono">
          {shoppingRange.from} → {shoppingRange.to}
        </p>

        {shoppingQ.isLoading ? (
          <div className="card h-24 animate-pulse" />
        ) : (shoppingQ.data?.items.length ?? 0) === 0 ? (
          <div className="card text-center text-sm text-[color:var(--color-ink-faint)] py-8">
            Sin compras —{" "}
            {shoppingTab === "week"
              ? "esta semana no hay platos planeados"
              : "este mes no hay platos planeados"}
            .
          </div>
        ) : (
          <div className="card space-y-2.5">
            {shoppingQ.data!.items.map((it) => {
              const pretty =
                it.amount !== null
                  ? formatQuantityWithUnit(it.amount, it.unit) || it.display
                  : it.display;
              return (
                <div key={`${it.name}-${it.unit ?? ""}`} className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-accent)] flex-shrink-0 mt-2" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-medium truncate">{it.name}</p>
                      <p className="mono text-xs text-[color:var(--color-accent)] font-semibold flex-shrink-0 tabular-nums">
                        {pretty}
                      </p>
                    </div>
                    <p className="text-[10px] text-[color:var(--color-ink-faint)] truncate">
                      {it.occurrences}× · {it.dishes.join(", ")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Catálogo CTA */}
      <section>
        <button
          onClick={() => setDishesOpen(true)}
          className="w-full card card-interactive flex items-center gap-3 text-left"
        >
          <span
            className="w-10 h-10 rounded-2xl grid place-items-center text-lg flex-shrink-0"
            style={{
              background: "color-mix(in oklab, var(--color-accent) 18%, transparent)",
              color: "var(--color-accent)",
            }}
          >
            📖
          </span>
          <div className="flex-1">
            <p className="font-medium">Mi catálogo</p>
            <p className="text-xs text-[color:var(--color-ink-faint)]">
              {(dishesQ.data ?? []).length} platos · gestionar ingredientes
            </p>
          </div>
          <span className="text-[color:var(--color-ink-faint)]">›</span>
        </button>
      </section>

      {selectedDay && (
        <DayPlannerSheet
          ymd={selectedDay}
          plans={plansByDay.get(selectedDay) ?? []}
          dishes={dishesQ.data ?? []}
          onClose={() => setSelectedDay(null)}
        />
      )}

      <DishesSheet
        open={dishesOpen}
        onClose={() => setDishesOpen(false)}
        dishes={dishesQ.data ?? []}
      />
    </main>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "up";
}) {
  return (
    <div className="card !p-3 text-center">
      <p
        className={`mono text-2xl font-light ${
          accent === "up" ? "text-[color:var(--color-up)]" : ""
        }`}
      >
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-ink-faint)] mt-0.5">
        {label}
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1 rounded-full text-xs font-medium transition ${
        active
          ? "bg-[color:var(--color-bg)] text-[color:var(--color-ink)] shadow-sm"
          : "text-[color:var(--color-ink-soft)]"
      }`}
    >
      {children}
    </button>
  );
}
