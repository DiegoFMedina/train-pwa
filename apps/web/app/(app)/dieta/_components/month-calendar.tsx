"use client";

import type { MealPlan, MealType } from "@mi-centro/shared";
import { monthGrid, todayYmd } from "@/lib/dates";
import { MEAL_META, MEAL_ORDER } from "./meal-meta";

interface Props {
  year: number;
  month0: number; // 0..11
  plansByDay: Map<string, MealPlan[]>;
  selectedYmd: string | null;
  onSelect: (ymd: string) => void;
}

const WEEK_HEADERS = ["L", "M", "X", "J", "V", "S", "D"];

export function MonthCalendar({
  year,
  month0,
  plansByDay,
  selectedYmd,
  onSelect,
}: Props) {
  const cells = monthGrid(year, month0);
  const today = todayYmd();

  return (
    <div>
      <div className="grid grid-cols-7 mb-2">
        {WEEK_HEADERS.map((w) => (
          <div
            key={w}
            className="text-center text-[10px] uppercase tracking-wider text-[color:var(--color-ink-faint)] font-medium"
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((cell) => {
          const plans = plansByDay.get(cell.ymd) ?? [];
          const planned = new Set(plans.map((p) => p.meal_type));
          const eaten = new Set(
            plans.filter((p) => p.status === "eaten").map((p) => p.meal_type),
          );
          const isToday = cell.ymd === today;
          const isSelected = cell.ymd === selectedYmd;
          const isPast = cell.ymd < today;

          return (
            <button
              key={cell.ymd}
              type="button"
              onClick={() => onSelect(cell.ymd)}
              aria-label={`Día ${cell.day}, ${plans.length} comidas planeadas`}
              aria-pressed={isSelected}
              className={`
                relative aspect-square rounded-2xl flex flex-col items-stretch justify-between p-1.5
                transition-all duration-200
                ${cell.inMonth ? "" : "opacity-30"}
                ${isSelected
                  ? "ring-2 ring-[color:var(--color-accent)] bg-[color:var(--color-surface-2)] scale-[1.04]"
                  : isToday
                    ? "ring-1 ring-[color:var(--color-accent)]/40 bg-[color:var(--color-surface)]"
                    : plans.length > 0
                      ? "bg-[color:var(--color-surface)]"
                      : "bg-[color:var(--color-surface)]/40 hover:bg-[color:var(--color-surface)]"
                }
                active:scale-95
              `}
            >
              <span
                className={`text-[11px] font-medium leading-none self-end mono ${
                  isToday
                    ? "text-[color:var(--color-accent)]"
                    : isPast
                      ? "text-[color:var(--color-ink-faint)]"
                      : "text-[color:var(--color-ink-soft)]"
                }`}
              >
                {cell.day}
              </span>

              <div className="flex items-end justify-center gap-[3px]">
                {MEAL_ORDER.map((mt: MealType) => {
                  const has = planned.has(mt);
                  const done = eaten.has(mt);
                  return (
                    <span
                      key={mt}
                      aria-hidden
                      className="w-1 rounded-full transition-all"
                      style={{
                        height: has ? (done ? 8 : 6) : 3,
                        background: has
                          ? done
                            ? `color-mix(in oklab, ${MEAL_META[mt].color} 100%, transparent)`
                            : `color-mix(in oklab, ${MEAL_META[mt].color} 70%, transparent)`
                          : "var(--color-line)",
                        opacity: has ? (done ? 0.45 : 1) : 0.5,
                      }}
                    />
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
