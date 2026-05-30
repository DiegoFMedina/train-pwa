import { z } from "zod";
import { IsoDateTimeSchema, UuidSchema } from "./common.js";
import { CategorySchema } from "./finance.js";
import {
  FinancialGoalSchema,
  GoalContributionSchema,
  RecurringTransactionSchema,
  TransactionSchema,
} from "./finance.js";
import { RoutineLogSchema, RoutineSchema } from "./routines.js";
import {
  DishIngredientSchema,
  DishSchema,
  MealPlanSchema,
} from "./diet.js";

// Entidades sincronizables. El orden importa: las dependencias se aplican primero
// (ej: categories antes que transactions, dishes antes que dish_ingredients).
export const SyncEntitySchema = z.enum([
  "categories",
  "recurring_transactions",
  "transactions",
  "financial_goals",
  "goal_contributions",
  "routines",
  "routine_logs",
  "dishes",
  "dish_ingredients",
  "meal_plans",
]);
export type SyncEntity = z.infer<typeof SyncEntitySchema>;

export const SyncOpSchema = z.enum(["create", "update", "delete"]);
export type SyncOp = z.infer<typeof SyncOpSchema>;

// Una mutación pendiente que sube el cliente.
// `client_id` permite que el server sea idempotente: si el mismo client_id
// llega 2 veces (red intermitente), se aplica una sola vez.
export const SyncMutationSchema = z.object({
  client_id: UuidSchema,
  entity: SyncEntitySchema,
  op: SyncOpSchema,
  entity_id: UuidSchema,
  payload: z.unknown(),
  client_ts: IsoDateTimeSchema,
  base_version: z.number().int().nonnegative().optional(),
});
export type SyncMutation = z.infer<typeof SyncMutationSchema>;

export const SyncPushRequestSchema = z.object({
  mutations: z.array(SyncMutationSchema).max(500),
});
export type SyncPushRequest = z.infer<typeof SyncPushRequestSchema>;

export const SyncMutationResultSchema = z.discriminatedUnion("status", [
  z.object({
    client_id: UuidSchema,
    status: z.literal("applied"),
    entity_id: UuidSchema,
    server_version: z.number().int().positive(),
    server_updated_at: IsoDateTimeSchema,
  }),
  z.object({
    client_id: UuidSchema,
    status: z.literal("rejected"),
    reason: z.string(),
  }),
  z.object({
    client_id: UuidSchema,
    status: z.literal("conflict"),
    server_version: z.number().int().positive(),
    server_payload: z.unknown(),
  }),
]);
export type SyncMutationResult = z.infer<typeof SyncMutationResultSchema>;

export const SyncPushResponseSchema = z.object({
  results: z.array(SyncMutationResultSchema),
  server_now: IsoDateTimeSchema,
});
export type SyncPushResponse = z.infer<typeof SyncPushResponseSchema>;

// Pull: el cliente pide el delta desde `since`. El server devuelve un
// payload por cada entidad con los registros (incluidos soft-deletes).
export const SyncPullQuerySchema = z.object({
  since: IsoDateTimeSchema.optional(),
});
export type SyncPullQuery = z.infer<typeof SyncPullQuerySchema>;

export const SyncPullResponseSchema = z.object({
  server_now: IsoDateTimeSchema,
  cursor: IsoDateTimeSchema,
  entities: z.object({
    categories: z.array(CategorySchema),
    transactions: z.array(TransactionSchema),
    recurring_transactions: z.array(RecurringTransactionSchema),
    financial_goals: z.array(FinancialGoalSchema),
    goal_contributions: z.array(GoalContributionSchema),
    routines: z.array(RoutineSchema),
    routine_logs: z.array(RoutineLogSchema),
    dishes: z.array(DishSchema),
    dish_ingredients: z.array(DishIngredientSchema),
    meal_plans: z.array(MealPlanSchema),
  }),
});
export type SyncPullResponse = z.infer<typeof SyncPullResponseSchema>;
