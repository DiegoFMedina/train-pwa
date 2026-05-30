import type {
  Dish as SharedDish,
  DishIngredient as SharedIngredient,
  MealPlan as SharedMealPlan,
} from "@mi-centro/shared";
import type { dishes, dishIngredients, mealPlans } from "../db/schema";

const iso = (d: Date): string => d.toISOString();
const isoOrNull = (d: Date | null): string | null => (d ? iso(d) : null);
const dateOnly = (d: Date | string): string =>
  typeof d === "string" ? d : d.toISOString().slice(0, 10);
const timeOrNull = (s: string | null): string | null => (s ? s.slice(0, 5) : null);

export function toDish(r: typeof dishes.$inferSelect): SharedDish {
  return {
    id: r.id,
    user_id: r.userId,
    name: r.name,
    notes: r.notes,
    prep_minutes: r.prepMinutes,
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
    deleted_at: isoOrNull(r.deletedAt),
    version: r.version,
  };
}

export function toIngredient(
  r: typeof dishIngredients.$inferSelect,
): SharedIngredient {
  return {
    id: r.id,
    user_id: r.userId,
    dish_id: r.dishId,
    name: r.name,
    quantity: r.quantity,
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
    deleted_at: isoOrNull(r.deletedAt),
    version: r.version,
  };
}

export function toMealPlan(r: typeof mealPlans.$inferSelect): SharedMealPlan {
  return {
    id: r.id,
    user_id: r.userId,
    dish_id: r.dishId,
    plan_date: dateOnly(r.planDate),
    meal_type: r.mealType as SharedMealPlan["meal_type"],
    cook_time: timeOrNull(r.cookTime),
    eat_time: timeOrNull(r.eatTime),
    notify_mode: r.notifyMode as SharedMealPlan["notify_mode"],
    status: r.status as SharedMealPlan["status"],
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
    deleted_at: isoOrNull(r.deletedAt),
    version: r.version,
  };
}
