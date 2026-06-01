import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, isNull, type SQL } from "drizzle-orm";
import type {
  CreateFinancialGoal,
  FinancialGoal,
  UpdateFinancialGoal,
} from "@mi-centro/shared";
import type { RequestScope } from "../common/scope";
import { DB, type Db } from "../db/db.module";
import { financialGoals } from "../db/schema";
import { toGoal } from "./mappers";

function scopeCondition(userId: string, scope: RequestScope): SQL | undefined {
  if (scope.kind === "personal") {
    return and(
      eq(financialGoals.userId, userId),
      isNull(financialGoals.coupleId),
    );
  }
  return eq(financialGoals.coupleId, scope.coupleId!);
}

@Injectable()
export class GoalsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(userId: string, scope: RequestScope): Promise<FinancialGoal[]> {
    const rows = await this.db
      .select()
      .from(financialGoals)
      .where(
        and(scopeCondition(userId, scope), isNull(financialGoals.deletedAt)),
      )
      .orderBy(desc(financialGoals.createdAt));
    return rows.map(toGoal);
  }

  async create(
    userId: string,
    scope: RequestScope,
    input: CreateFinancialGoal,
  ): Promise<FinancialGoal> {
    const [row] = await this.db
      .insert(financialGoals)
      .values({
        ...(input.id ? { id: input.id } : {}),
        userId,
        coupleId: scope.coupleId,
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
    scope: RequestScope,
    id: string,
    patch: UpdateFinancialGoal,
  ): Promise<FinancialGoal> {
    const updates: Partial<typeof financialGoals.$inferInsert> = {};
    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.target_amount !== undefined)
      updates.targetAmount = patch.target_amount.toFixed(2);
    if (patch.currency !== undefined) updates.currency = patch.currency;
    if (patch.target_date !== undefined) updates.targetDate = patch.target_date;
    if (patch.status !== undefined) updates.status = patch.status;

    if (Object.keys(updates).length === 0) {
      return this.findById(userId, scope, id);
    }
    updates.updatedAt = new Date();

    const [row] = await this.db
      .update(financialGoals)
      .set(updates)
      .where(
        and(
          eq(financialGoals.id, id),
          scopeCondition(userId, scope),
          isNull(financialGoals.deletedAt),
        ),
      )
      .returning();
    if (!row) throw new NotFoundException("Meta no encontrada");
    return toGoal(row);
  }

  async softDelete(
    userId: string,
    scope: RequestScope,
    id: string,
  ): Promise<void> {
    const [row] = await this.db
      .update(financialGoals)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(financialGoals.id, id),
          scopeCondition(userId, scope),
          isNull(financialGoals.deletedAt),
        ),
      )
      .returning({ id: financialGoals.id });
    if (!row) throw new NotFoundException("Meta no encontrada");
  }

  /** Para el sub-recurso contributions: valida que la goal exista y sea accesible. */
  async ensureExists(
    userId: string,
    scope: RequestScope,
    id: string,
  ): Promise<void> {
    await this.findById(userId, scope, id);
  }

  private async findById(
    userId: string,
    scope: RequestScope,
    id: string,
  ): Promise<FinancialGoal> {
    const [row] = await this.db
      .select()
      .from(financialGoals)
      .where(
        and(
          eq(financialGoals.id, id),
          scopeCondition(userId, scope),
          isNull(financialGoals.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Meta no encontrada");
    return toGoal(row);
  }
}
