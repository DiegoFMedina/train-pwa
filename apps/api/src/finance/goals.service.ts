import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, isNull } from "drizzle-orm";
import type {
  CreateFinancialGoal,
  FinancialGoal,
  UpdateFinancialGoal,
} from "@mi-centro/shared";
import { DB, type Db } from "../db/db.module";
import { financialGoals } from "../db/schema";
import { toGoal } from "./mappers";

@Injectable()
export class GoalsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(userId: string): Promise<FinancialGoal[]> {
    const rows = await this.db
      .select()
      .from(financialGoals)
      .where(
        and(eq(financialGoals.userId, userId), isNull(financialGoals.deletedAt)),
      )
      .orderBy(desc(financialGoals.createdAt));
    return rows.map(toGoal);
  }

  async create(userId: string, input: CreateFinancialGoal): Promise<FinancialGoal> {
    const [row] = await this.db
      .insert(financialGoals)
      .values({
        ...(input.id ? { id: input.id } : {}),
        userId,
        name: input.name,
        targetAmount: input.target_amount.toFixed(2),
        currency: input.currency ?? "CLP",
        targetDate: input.target_date ?? null,
        status: input.status ?? "active",
      })
      .returning();
    if (!row) throw new Error("INSERT financial_goals no devolvió fila");
    return toGoal(row);
  }

  async update(
    userId: string,
    id: string,
    patch: UpdateFinancialGoal,
  ): Promise<FinancialGoal> {
    const updates: Partial<typeof financialGoals.$inferInsert> = {};
    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.target_amount !== undefined) updates.targetAmount = patch.target_amount.toFixed(2);
    if (patch.currency !== undefined) updates.currency = patch.currency;
    if (patch.target_date !== undefined) updates.targetDate = patch.target_date;
    if (patch.status !== undefined) updates.status = patch.status;

    if (Object.keys(updates).length === 0) {
      return this.findById(userId, id);
    }
    updates.updatedAt = new Date();

    const [row] = await this.db
      .update(financialGoals)
      .set(updates)
      .where(
        and(
          eq(financialGoals.id, id),
          eq(financialGoals.userId, userId),
          isNull(financialGoals.deletedAt),
        ),
      )
      .returning();
    if (!row) throw new NotFoundException("Meta no encontrada");
    return toGoal(row);
  }

  async softDelete(userId: string, id: string): Promise<void> {
    const [row] = await this.db
      .update(financialGoals)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(financialGoals.id, id),
          eq(financialGoals.userId, userId),
          isNull(financialGoals.deletedAt),
        ),
      )
      .returning({ id: financialGoals.id });
    if (!row) throw new NotFoundException("Meta no encontrada");
  }

  async ensureExists(userId: string, id: string): Promise<void> {
    await this.findById(userId, id);
  }

  private async findById(userId: string, id: string): Promise<FinancialGoal> {
    const [row] = await this.db
      .select()
      .from(financialGoals)
      .where(
        and(
          eq(financialGoals.id, id),
          eq(financialGoals.userId, userId),
          isNull(financialGoals.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Meta no encontrada");
    return toGoal(row);
  }
}
