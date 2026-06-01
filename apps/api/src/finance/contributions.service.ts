import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, isNull } from "drizzle-orm";
import type {
  CreateGoalContribution,
  GoalContribution,
} from "@mi-centro/shared";
import type { RequestScope } from "../common/scope";
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
    scope: RequestScope,
    goalId: string,
  ): Promise<GoalContribution[]> {
    // Valida que el goal sea accesible para este scope.
    await this.goals.ensureExists(userId, scope, goalId);
    const rows = await this.db
      .select()
      .from(goalContributions)
      .where(
        and(
          eq(goalContributions.goalId, goalId),
          isNull(goalContributions.deletedAt),
        ),
      )
      .orderBy(desc(goalContributions.occurredOn));
    return rows.map(toContribution);
  }

  async create(
    userId: string,
    scope: RequestScope,
    goalId: string,
    input: Omit<CreateGoalContribution, "goal_id">,
  ): Promise<GoalContribution> {
    await this.goals.ensureExists(userId, scope, goalId);
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
    scope: RequestScope,
    goalId: string,
    id: string,
  ): Promise<void> {
    await this.goals.ensureExists(userId, scope, goalId);
    const [row] = await this.db
      .update(goalContributions)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(goalContributions.id, id),
          eq(goalContributions.goalId, goalId),
          isNull(goalContributions.deletedAt),
        ),
      )
      .returning({ id: goalContributions.id });
    if (!row) throw new NotFoundException("Aporte no encontrado");
  }
}
