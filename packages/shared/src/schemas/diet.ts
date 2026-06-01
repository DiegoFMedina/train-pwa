import { z } from "zod";
import {
  IsoDateSchema,
  NotifyModeSchema,
  SyncFieldsSchema,
  TimeOfDaySchema,
  UuidSchema,
} from "./common.js";

// ─── Dishes ───────────────────────────────────────────────────

export const DishBaseSchema = z.object({
  name: z.string().min(1).max(120),
  notes: z.string().max(2000).nullable().optional(),
  prep_minutes: z.number().int().nonnegative().max(1440).nullable().optional(),
});

export const DishSchema = DishBaseSchema.merge(SyncFieldsSchema).extend({
  user_id: UuidSchema,
  couple_id: UuidSchema.nullable(),
});
export type Dish = z.infer<typeof DishSchema>;

export const CreateDishSchema = DishBaseSchema.extend({
  id: UuidSchema.optional(),
});
export type CreateDish = z.infer<typeof CreateDishSchema>;

export const UpdateDishSchema = DishBaseSchema.partial();
export type UpdateDish = z.infer<typeof UpdateDishSchema>;

// ─── Dish ingredients ─────────────────────────────────────────

export const DishIngredientBaseSchema = z.object({
  dish_id: UuidSchema,
  name: z.string().min(1).max(120),
  // Cantidad estructurada (preferida).
  amount: z.number().finite().positive().nullable().optional(),
  unit: z.string().max(20).nullable().optional(),
  // Texto libre legacy (display fallback cuando amount IS NULL).
  quantity: z.string().max(60).nullable().optional(),
});

export const DishIngredientSchema = DishIngredientBaseSchema
  .merge(SyncFieldsSchema)
  .extend({ user_id: UuidSchema });
export type DishIngredient = z.infer<typeof DishIngredientSchema>;

export const CreateDishIngredientSchema = DishIngredientBaseSchema.extend({
  id: UuidSchema.optional(),
});
export type CreateDishIngredient = z.infer<typeof CreateDishIngredientSchema>;

// ─── Meal plans ───────────────────────────────────────────────

export const MealTypeSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);
export type MealType = z.infer<typeof MealTypeSchema>;

export const MealStatusSchema = z.enum(["planned", "eaten", "skipped"]);
export type MealStatus = z.infer<typeof MealStatusSchema>;

export const MealPlanBaseSchema = z.object({
  dish_id: UuidSchema.nullable().optional(),
  plan_date: IsoDateSchema,
  meal_type: MealTypeSchema,
  cook_time: TimeOfDaySchema.nullable().optional(),
  eat_time: TimeOfDaySchema.nullable().optional(),
  notify_mode: NotifyModeSchema.default("notify"),
  status: MealStatusSchema.default("planned"),
});

export const MealPlanSchema = MealPlanBaseSchema
  .merge(SyncFieldsSchema)
  .extend({
    user_id: UuidSchema,
    // Denormalizado para vista compartida (solo viene poblado en scope=couple).
    user_name: z.string().optional(),
  });
export type MealPlan = z.infer<typeof MealPlanSchema>;

export const CreateMealPlanSchema = MealPlanBaseSchema.extend({
  id: UuidSchema.optional(),
});
export type CreateMealPlan = z.infer<typeof CreateMealPlanSchema>;

export const UpdateMealPlanSchema = MealPlanBaseSchema.partial();
export type UpdateMealPlan = z.infer<typeof UpdateMealPlanSchema>;

// ─── Shopping list (derivada del plan semanal) ────────────────

export const ShoppingListItemSchema = z.object({
  name: z.string(),
  amount: z.number().nullable(),
  unit: z.string().nullable(),
  // Texto presentable cuando hay legacy o mix de unidades.
  display: z.string(),
  occurrences: z.number().int().positive(),
  dishes: z.array(z.string()),
});
export type ShoppingListItem = z.infer<typeof ShoppingListItemSchema>;

export const ShoppingListSchema = z.object({
  from: IsoDateSchema,
  to: IsoDateSchema,
  items: z.array(ShoppingListItemSchema),
});
export type ShoppingList = z.infer<typeof ShoppingListSchema>;
