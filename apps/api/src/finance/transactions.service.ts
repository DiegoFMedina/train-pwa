import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import type {
  CreateTransaction,
  Transaction,
  TransactionFilter,
  UpdateTransaction,
} from "@mi-centro/shared";
import { DB, type Db } from "../db/db.module";
import { transactions } from "../db/schema";
import { toTransaction } from "./mappers";

@Injectable()
export class TransactionsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(userId: string, filter: TransactionFilter): Promise<Transaction[]> {
    const conditions = [
      eq(transactions.userId, userId),
      isNull(transactions.deletedAt),
    ];
    if (filter.from) conditions.push(gte(transactions.occurredOn, filter.from));
    if (filter.to) conditions.push(lte(transactions.occurredOn, filter.to));
    if (filter.category_id) conditions.push(eq(transactions.categoryId, filter.category_id));
    if (filter.kind) conditions.push(eq(transactions.kind, filter.kind));

    const rows = await this.db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt));
    return rows.map(toTransaction);
  }

  async create(userId: string, input: CreateTransaction): Promise<Transaction> {
    const [row] = await this.db
      .insert(transactions)
      .values({
        ...(input.id ? { id: input.id } : {}),
        userId,
        categoryId: input.category_id ?? null,
        kind: input.kind,
        amount: input.amount.toFixed(2),
        currency: input.currency ?? "CLP",
        description: input.description ?? null,
        occurredOn: input.occurred_on,
        recurringId: input.recurring_id ?? null,
      })
      .returning();
    if (!row) throw new Error("INSERT transactions no devolvió fila");
    return toTransaction(row);
  }

  async update(
    userId: string,
    id: string,
    patch: UpdateTransaction,
  ): Promise<Transaction> {
    const updates: Partial<typeof transactions.$inferInsert> = {};
    if (patch.category_id !== undefined) updates.categoryId = patch.category_id;
    if (patch.kind !== undefined) updates.kind = patch.kind;
    if (patch.amount !== undefined) updates.amount = patch.amount.toFixed(2);
    if (patch.currency !== undefined) updates.currency = patch.currency;
    if (patch.description !== undefined) updates.description = patch.description;
    if (patch.occurred_on !== undefined) updates.occurredOn = patch.occurred_on;
    if (patch.recurring_id !== undefined) updates.recurringId = patch.recurring_id;

    if (Object.keys(updates).length === 0) {
      return this.findById(userId, id);
    }
    updates.updatedAt = new Date();

    const [row] = await this.db
      .update(transactions)
      .set(updates)
      .where(
        and(
          eq(transactions.id, id),
          eq(transactions.userId, userId),
          isNull(transactions.deletedAt),
        ),
      )
      .returning();
    if (!row) throw new NotFoundException("Movimiento no encontrado");
    return toTransaction(row);
  }

  async softDelete(userId: string, id: string): Promise<void> {
    const [row] = await this.db
      .update(transactions)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(transactions.id, id),
          eq(transactions.userId, userId),
          isNull(transactions.deletedAt),
        ),
      )
      .returning({ id: transactions.id });
    if (!row) throw new NotFoundException("Movimiento no encontrado");
  }

  private async findById(userId: string, id: string): Promise<Transaction> {
    const [row] = await this.db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, id),
          eq(transactions.userId, userId),
          isNull(transactions.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Movimiento no encontrado");
    return toTransaction(row);
  }
}
