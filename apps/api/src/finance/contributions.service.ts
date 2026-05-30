import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, isNull } from "drizzle-orm";
import type {
  CreateGoalContribution,
  GoalContribution,
} from "@mi-centro/shared";
import { DB, type Db } from "../db/db.module";
import { goalContributions } from "../db/schema";
import { GoalsService } from "./goals.service";
import { toContribution } from "./mappers";

@Injectable()
export class ContributionsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly goals: GoalsService,
  ) {}

  async listForGoal(
    userId: string,
    goalId: string,
  ): Promise<GoalContribution[]> {
    await this.goals.ensureExists(userId, goalId);
    const rows = await this.db
      .select()
      .from(goalContributions)
      .where(
        and(
          eq(goalContributions.userId, userId),
          eq(goalContributions.goalId, goalId),
          isNull(goalContributions.deletedAt),
        ),
      )
      .orderBy(desc(goalContributions.occurredOn));
    return rows.map(toContribution);
  }

  async create(
    userId: string,
    goalId: string,
    input: Omit<CreateGoalContribution, "goal_id">,
  ): Promise<GoalContribution> {
    await this.goals.ensureExists(userId, goalId);
    const [row] = await this.db
      .insert(goalContributions)
      .values({
        ...(input.id ? { id: input.id } : {}),
        userId,
        goalId,
        amount: input.amount.toFixed(2),
        occurredOn: input.occurred_on,
        note: input.note ?? null,
      })
      .returning();
    if (!row) throw new Error("INSERT goal_contributions no devolvió fila");
    return toContribution(row);
  }

  async softDelete(
    userId: string,
    goalId: string,
    id: string,
  ): Promise<void> {
    const [row] = await this.db
      .update(goalContributions)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(goalContributions.id, id),
          eq(goalContributions.goalId, goalId),
          eq(goalContributions.userId, userId),
          isNull(goalContributions.deletedAt),
        ),
      )
      .returning({ id: goalContributions.id });
    if (!row) throw new NotFoundException("Aporte no encontrado");
  }
}
