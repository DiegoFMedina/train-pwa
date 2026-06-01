import type { MealType } from "@mi-centro/shared";

export interface MealMeta {
  label: string;
  short: string;
  color: string;
  emoji: string;
}

export const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export const MEAL_META: Record<MealType, MealMeta> = {
  breakfast: {
    label: "Desayuno",
    short: "Des",
    color: "var(--color-accent)",
    emoji: "☀️",
  },
  lunch: {
    label: "Almuerzo",
    short: "Alm",
    color: "var(--color-accent-2)",
    emoji: "🍽",
  },
  dinner: {
    label: "Cena",
    short: "Cen",
    color: "var(--color-rose)",
    emoji: "🌙",
  },
  snack: {
    label: "Snack",
    short: "Snk",
    color: "var(--color-jade)",
    emoji: "✦",
  },
};
