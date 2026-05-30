import type {
  Category as SharedCategory,
  FinancialGoal as SharedGoal,
  GoalContribution as SharedContribution,
  RecurringTransaction as SharedRecurring,
  Transaction as SharedTransaction,
} from "@mi-centro/shared";
import type {
  categories,
  financialGoals,
  goalContributions,
  recurringTransactions,
  transactions,
} from "../db/schema";

// Drizzle node-postgres devuelve NUMERIC como string. Convertimos a number.
const num = (v: string): number => Number(v);
const dateOnly = (d: Date | string): string =>
  typeof d === "string" ? d : d.toISOString().slice(0, 10);
const iso = (d: Date): string => d.toISOString();
const isoOrNull = (d: Date | null): string | null => (d ? iso(d) : null);

export function toCategory(r: typeof categories.$inferSelect): SharedCategory {
  return {
    id: r.id,
    user_id: r.userId,
    name: r.name,
    kind: r.kind as SharedCategory["kind"],
    color: r.color,
    icon: r.icon,
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
    deleted_at: isoOrNull(r.deletedAt),
    version: r.version,
  };
}

export function toTransaction(
  r: typeof transactions.$inferSelect,
): SharedTransaction {
  return {
    id: r.id,
    user_id: r.userId,
    category_id: r.categoryId,
    kind: r.kind as SharedTransaction["kind"],
    amount: num(r.amount),
    currency: r.currency,
    description: r.description,
    occurred_on: dateOnly(r.occurredOn),
    recurring_id: r.recurringId,
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
    deleted_at: isoOrNull(r.deletedAt),
    version: r.version,
  };
}

export function toRecurring(
  r: typeof recurringTransactions.$inferSelect,
): SharedRecurring {
  return {
    id: r.id,
    user_id: r.userId,
    category_id: r.categoryId,
    kind: r.kind as SharedRecurring["kind"],
    amount: num(r.amount),
    currency: r.currency,
    description: r.description,
    rrule: r.rrule,
    next_run_on: dateOnly(r.nextRunOn),
    active: r.active,
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
    deleted_at: isoOrNull(r.deletedAt),
    version: r.version,
  };
}

export function toGoal(r: typeof financialGoals.$inferSelect): SharedGoal {
  return {
    id: r.id,
    user_id: r.userId,
    name: r.name,
    target_amount: num(r.targetAmount),
    currency: r.currency,
    target_date: r.targetDate ? dateOnly(r.targetDate) : null,
    status: r.status as SharedGoal["status"],
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
    deleted_at: isoOrNull(r.deletedAt),
    version: r.version,
  };
}

export function toContribution(
  r: typeof goalContributions.$inferSelect,
): SharedContribution {
  return {
    id: r.id,
    user_id: r.userId,
    goal_id: r.goalId,
    amount: num(r.amount),
    occurred_on: dateOnly(r.occurredOn),
    note: r.note,
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
    deleted_at: isoOrNull(r.deletedAt),
    version: r.version,
  };
}
