import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, isNull, type SQL } from "drizzle-orm";
import type {
  CreateRecurringTransaction,
  RecurringTransaction,
  UpdateRecurringTransaction,
} from "@mi-centro/shared";
import type { RequestScope } from "../common/scope";
import { DB, type Db } from "../db/db.module";
import { recurringTransactions } from "../db/schema";
import { toRecurring } from "./mappers";

function scopeCondition(userId: string, scope: RequestScope): SQL | undefined {
  if (scope.kind === "personal") {
    return and(
      eq(recurringTransactions.userId, userId),
      isNull(recurringTransactions.coupleId),
    );
  }
  return eq(recurringTransactions.coupleId, scope.coupleId!);
}

@Injectable()
export class RecurringService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(
    userId: string,
    scope: RequestScope,
  ): Promise<RecurringTransaction[]> {
    const rows = await this.db
      .select()
      .from(recurringTransactions)
      .where(
        and(
          scopeCondition(userId, scope),
          isNull(recurringTransactions.deletedAt),
        ),
      )
      .orderBy(desc(recurringTransactions.nextRunOn));
    return rows.map(toRecurring);
  }

  async create(
    userId: string,
    scope: RequestScope,
    input: CreateRecurringTransaction,
  ): Promise<RecurringTransaction> {
    const [row] = await this.db
      .insert(recurringTransactions)
      .values({
        ...(input.id ? { id: input.id } : {}),
        userId,
        coupleId: scope.coupleId,
        categoryId: input.category_id ?? null,
        kind: input.kind,
        amount: input.amount.toFixed(2),
        currency: input.currency ?? "CLP",
        description: input.description ?? null,
        rrule: input.rrule,
        nextRunOn: input.next_run_on,
        active: input.active ?? true,
      })
      .returning();
    if (!row) throw new Error("INSERT recurring_transactions no devolvió fila");
    return toRecurring(row);
  }

  async update(
    userId: string,
    scope: RequestScope,
    id: string,
    patch: UpdateRecurringTransaction,
  ): Promise<RecurringTransaction> {
    const updates: Partial<typeof recurringTransactions.$inferInsert> = {};
    if (patch.category_id !== undefined) updates.categoryId = patch.category_id;
    if (patch.kind !== undefined) updates.kind = patch.kind;
    if (patch.amount !== undefined) updates.amount = patch.amount.toFixed(2);
    if (patch.currency !== undefined) updates.currency = patch.currency;
    if (patch.description !== undefined)
      updates.description = patch.description;
    if (patch.rrule !== undefined) updates.rrule = patch.rrule;
    if (patch.next_run_on !== undefined) updates.nextRunOn = patch.next_run_on;
    if (patch.active !== undefined) updates.active = patch.active;

    if (Object.keys(updates).length === 0) {
      return this.findById(userId, scope, id);
    }
    updates.updatedAt = new Date();

    const [row] = await this.db
      .update(recurringTransactions)
      .set(updates)
      .where(
        and(
          eq(recurringTransactions.id, id),
          scopeCondition(userId, scope),
          isNull(recurringTransactions.deletedAt),
        ),
      )
      .returning();
    if (!row) throw new NotFoundException("Recurrente no encontrada");
    return toRecurring(row);
  }

  async softDelete(
    userId: string,
    scope: RequestScope,
    id: string,
  ): Promise<void> {
    const [row] = await this.db
      .update(recurringTransactions)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(recurringTransactions.id, id),
          scopeCondition(userId, scope),
          isNull(recurringTransactions.deletedAt),
        ),
      )
      .returning({ id: recurringTransactions.id });
    if (!row) throw new NotFoundException("Recurrente no encontrada");
  }

  private async findById(
    userId: string,
    scope: RequestScope,
    id: string,
  ): Promise<RecurringTransaction> {
    const [row] = await this.db
      .select()
      .from(recurringTransactions)
      .where(
        and(
          eq(recurringTransactions.id, id),
          scopeCondition(userId, scope),
          isNull(recurringTransactions.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Recurrente no encontrada");
    return toRecurring(row);
  }
}
