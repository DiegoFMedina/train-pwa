import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, isNull } from "drizzle-orm";
import type {
  CreateRecurringTransaction,
  RecurringTransaction,
  UpdateRecurringTransaction,
} from "@mi-centro/shared";
import { DB, type Db } from "../db/db.module";
import { recurringTransactions } from "../db/schema";
import { toRecurring } from "./mappers";

@Injectable()
export class RecurringService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(userId: string): Promise<RecurringTransaction[]> {
    const rows = await this.db
      .select()
      .from(recurringTransactions)
      .where(
        and(
          eq(recurringTransactions.userId, userId),
          isNull(recurringTransactions.deletedAt),
        ),
      )
      .orderBy(desc(recurringTransactions.nextRunOn));
    return rows.map(toRecurring);
  }

  async create(
    userId: string,
    input: CreateRecurringTransaction,
  ): Promise<RecurringTransaction> {
    const [row] = await this.db
      .insert(recurringTransactions)
      .values({
        ...(input.id ? { id: input.id } : {}),
        userId,
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
    id: string,
    patch: UpdateRecurringTransaction,
  ): Promise<RecurringTransaction> {
    const updates: Partial<typeof recurringTransactions.$inferInsert> = {};
    if (patch.category_id !== undefined) updates.categoryId = patch.category_id;
    if (patch.kind !== undefined) updates.kind = patch.kind;
    if (patch.amount !== undefined) updates.amount = patch.amount.toFixed(2);
    if (patch.currency !== undefined) updates.currency = patch.currency;
    if (patch.description !== undefined) updates.description = patch.description;
    if (patch.rrule !== undefined) updates.rrule = patch.rrule;
    if (patch.next_run_on !== undefined) updates.nextRunOn = patch.next_run_on;
    if (patch.active !== undefined) updates.active = patch.active;

    if (Object.keys(updates).length === 0) {
      return this.findById(userId, id);
    }
    updates.updatedAt = new Date();

    const [row] = await this.db
      .update(recurringTransactions)
      .set(updates)
      .where(
        and(
          eq(recurringTransactions.id, id),
          eq(recurringTransactions.userId, userId),
          isNull(recurringTransactions.deletedAt),
        ),
      )
      .returning();
    if (!row) throw new NotFoundException("Recurrente no encontrada");
    return toRecurring(row);
  }

  async softDelete(userId: string, id: string): Promise<void> {
    const [row] = await this.db
      .update(recurringTransactions)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(recurringTransactions.id, id),
          eq(recurringTransactions.userId, userId),
          isNull(recurringTransactions.deletedAt),
        ),
      )
      .returning({ id: recurringTransactions.id });
    if (!row) throw new NotFoundException("Recurrente no encontrada");
  }

  private async findById(
    userId: string,
    id: string,
  ): Promise<RecurringTransaction> {
    const [row] = await this.db
      .select()
      .from(recurringTransactions)
      .where(
        and(
          eq(recurringTransactions.id, id),
          eq(recurringTransactions.userId, userId),
          isNull(recurringTransactions.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Recurrente no encontrada");
    return toRecurring(row);
  }
}
