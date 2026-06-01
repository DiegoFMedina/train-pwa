import { z } from "zod";
import {
  CurrencySchema,
  HexColorSchema,
  IsoDateSchema,
  MoneyAmountSchema,
  SyncFieldsSchema,
  TransactionKindSchema,
  UuidSchema,
} from "./common.js";

// ─── Categories ───────────────────────────────────────────────

export const CategoryBaseSchema = z.object({
  name: z.string().min(1).max(80),
  kind: TransactionKindSchema,
  color: HexColorSchema.nullable().optional(),
  icon: z.string().max(40).nullable().optional(),
});

export const CategorySchema = CategoryBaseSchema.merge(SyncFieldsSchema).extend({
  user_id: UuidSchema,
  couple_id: UuidSchema.nullable(),
});
export type Category = z.infer<typeof CategorySchema>;

export const CreateCategorySchema = CategoryBaseSchema.extend({
  id: UuidSchema.optional(),
});
export type CreateCategory = z.infer<typeof CreateCategorySchema>;

export const UpdateCategorySchema = CategoryBaseSchema.partial();
export type UpdateCategory = z.infer<typeof UpdateCategorySchema>;

// ─── Transactions ─────────────────────────────────────────────

export const TransactionBaseSchema = z.object({
  category_id: UuidSchema.nullable().optional(),
  kind: TransactionKindSchema,
  amount: MoneyAmountSchema,
  currency: CurrencySchema,
  description: z.string().max(2000).nullable().optional(),
  occurred_on: IsoDateSchema,
  recurring_id: UuidSchema.nullable().optional(),
});

export const TransactionSchema = TransactionBaseSchema.merge(SyncFieldsSchema).extend({
  user_id: UuidSchema,
  couple_id: UuidSchema.nullable(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export const CreateTransactionSchema = TransactionBaseSchema.extend({
  id: UuidSchema.optional(),
});
export type CreateTransaction = z.infer<typeof CreateTransactionSchema>;

export const UpdateTransactionSchema = TransactionBaseSchema.partial();
export type UpdateTransaction = z.infer<typeof UpdateTransactionSchema>;

export const TransactionFilterSchema = z.object({
  from: IsoDateSchema.optional(),
  to: IsoDateSchema.optional(),
  category_id: UuidSchema.optional(),
  kind: TransactionKindSchema.optional(),
});
export type TransactionFilter = z.infer<typeof TransactionFilterSchema>;

// ─── Recurring transactions ───────────────────────────────────

export const RecurringTransactionBaseSchema = z.object({
  category_id: UuidSchema.nullable().optional(),
  kind: TransactionKindSchema,
  amount: MoneyAmountSchema,
  currency: CurrencySchema,
  description: z.string().max(2000).nullable().optional(),
  rrule: z.string().min(1, "RRULE RFC 5545 requerida"),
  next_run_on: IsoDateSchema,
  active: z.boolean().default(true),
});

export const RecurringTransactionSchema = RecurringTransactionBaseSchema
  .merge(SyncFieldsSchema)
  .extend({ user_id: UuidSchema, couple_id: UuidSchema.nullable() });
export type RecurringTransaction = z.infer<typeof RecurringTransactionSchema>;

export const CreateRecurringTransactionSchema = RecurringTransactionBaseSchema.extend({
  id: UuidSchema.optional(),
});
export type CreateRecurringTransaction = z.infer<typeof CreateRecurringTransactionSchema>;

export const UpdateRecurringTransactionSchema = RecurringTransactionBaseSchema.partial();
export type UpdateRecurringTransaction = z.infer<typeof UpdateRecurringTransactionSchema>;

// ─── Financial goals ──────────────────────────────────────────

export const GoalStatusSchema = z.enum(["active", "achieved", "archived"]);
export type GoalStatus = z.infer<typeof GoalStatusSchema>;

export const FinancialGoalBaseSchema = z.object({
  name: z.string().min(1).max(120),
  target_amount: MoneyAmountSchema.refine((n) => n > 0, "Debe ser mayor que 0"),
  currency: CurrencySchema,
  target_date: IsoDateSchema.nullable().optional(),
  status: GoalStatusSchema.default("active"),
});

export const FinancialGoalSchema = FinancialGoalBaseSchema
  .merge(SyncFieldsSchema)
  .extend({ user_id: UuidSchema, couple_id: UuidSchema.nullable() });
export type FinancialGoal = z.infer<typeof FinancialGoalSchema>;

export const CreateFinancialGoalSchema = FinancialGoalBaseSchema.extend({
  id: UuidSchema.optional(),
});
export type CreateFinancialGoal = z.infer<typeof CreateFinancialGoalSchema>;

export const UpdateFinancialGoalSchema = FinancialGoalBaseSchema.partial();
export type UpdateFinancialGoal = z.infer<typeof UpdateFinancialGoalSchema>;

// ─── Goal contributions ───────────────────────────────────────

export const GoalContributionBaseSchema = z.object({
  goal_id: UuidSchema,
  amount: MoneyAmountSchema.refine((n) => n > 0, "Debe ser mayor que 0"),
  occurred_on: IsoDateSchema,
  note: z.string().max(2000).nullable().optional(),
});

export const GoalContributionSchema = GoalContributionBaseSchema
  .merge(SyncFieldsSchema)
  .extend({ user_id: UuidSchema });
export type GoalContribution = z.infer<typeof GoalContributionSchema>;

export const CreateGoalContributionSchema = GoalContributionBaseSchema.extend({
  id: UuidSchema.optional(),
});
export type CreateGoalContribution = z.infer<typeof CreateGoalContributionSchema>;
