import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import type {
  CreateDish,
  CreateDishIngredient,
  Dish,
  DishIngredient,
  MealType,
  UpdateDish,
} from "@mi-centro/shared";
import type { RequestScope } from "../common/scope";
import { DB, type Db } from "../db/db.module";
import { coupleMembers, dishes, dishIngredients, mealPlans } from "../db/schema";
import { toDish, toIngredient } from "./mappers";

export interface DishSuggestion {
  dish: Dish;
  bucket: "stale" | "favorite" | "recent" | "never";
  last_used_on: string | null;
  uses_30d: number;
  uses_total: number;
}

function scopeCondition(userId: string, scope: RequestScope): SQL | undefined {
  if (scope.kind === "personal") {
    return and(eq(dishes.userId, userId), isNull(dishes.coupleId));
  }
  return eq(dishes.coupleId, scope.coupleId!);
}

@Injectable()
export class DishesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(userId: string, scope: RequestScope): Promise<Dish[]> {
    const rows = await this.db
      .select()
      .from(dishes)
      .where(and(scopeCondition(userId, scope), isNull(dishes.deletedAt)))
      .orderBy(asc(dishes.name));
    return rows.map((r) => toDish(r));
  }

  async create(
    userId: string,
    scope: RequestScope,
    input: CreateDish,
  ): Promise<Dish> {
    const [row] = await this.db
      .insert(dishes)
      .values({
        ...(input.id ? { id: input.id } : {}),
        userId,
        coupleId: scope.coupleId,
        name: input.name,
        notes: input.notes ?? null,
        prepMinutes: input.prep_minutes ?? null,
      })
      .returning();
    if (!row) throw new Error("INSERT dishes no devolvió fila");
    return toDish(row);
  }

  async update(
    userId: string,
    scope: RequestScope,
    id: string,
    patch: UpdateDish,
  ): Promise<Dish> {
    const updates: Partial<typeof dishes.$inferInsert> = {};
    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.notes !== undefined) updates.notes = patch.notes;
    if (patch.prep_minutes !== undefined)
      updates.prepMinutes = patch.prep_minutes;

    if (Object.keys(updates).length === 0) return this.findById(userId, scope, id);
    updates.updatedAt = new Date();

    const [row] = await this.db
      .update(dishes)
      .set(updates)
      .where(
        and(
          eq(dishes.id, id),
          scopeCondition(userId, scope),
          isNull(dishes.deletedAt),
        ),
      )
      .returning();
    if (!row) throw new NotFoundException("Plato no encontrado");
    return toDish(row);
  }

  async softDelete(
    userId: string,
    scope: RequestScope,
    id: string,
  ): Promise<void> {
    const [row] = await this.db
      .update(dishes)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(dishes.id, id),
          scopeCondition(userId, scope),
          isNull(dishes.deletedAt),
        ),
      )
      .returning({ id: dishes.id });
    if (!row) throw new NotFoundException("Plato no encontrado");
  }

  async listIngredients(
    userId: string,
    scope: RequestScope,
    dishId: string,
  ): Promise<DishIngredient[]> {
    await this.findById(userId, scope, dishId);
    const rows = await this.db
      .select()
      .from(dishIngredients)
      .where(
        and(
          eq(dishIngredients.dishId, dishId),
          isNull(dishIngredients.deletedAt),
        ),
      )
      .orderBy(asc(dishIngredients.name));
    return rows.map(toIngredient);
  }

  async addIngredient(
    userId: string,
    scope: RequestScope,
    dishId: string,
    input: Omit<CreateDishIngredient, "dish_id">,
  ): Promise<DishIngredient> {
    await this.findById(userId, scope, dishId);
    // El ingrediente toma el user_id del actor (audit), pero el control
    // de acceso lo hace via el dish padre (que ya validamos).
    const [row] = await this.db
      .insert(dishIngredients)
      .values({
        ...(input.id ? { id: input.id } : {}),
        userId,
        dishId,
        name: input.name,
        amount:
          input.amount !== undefined && input.amount !== null
            ? input.amount.toFixed(3)
            : null,
        unit: input.unit ?? null,
        quantity: input.quantity ?? null,
      })
      .returning();
    if (!row) throw new Error("INSERT dish_ingredients no devolvió fila");
    return toIngredient(row);
  }

  async removeIngredient(
    userId: string,
    scope: RequestScope,
    dishId: string,
    ingredientId: string,
  ): Promise<void> {
    await this.findById(userId, scope, dishId);
    const [row] = await this.db
      .update(dishIngredients)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(dishIngredients.id, ingredientId),
          eq(dishIngredients.dishId, dishId),
          isNull(dishIngredients.deletedAt),
        ),
      )
      .returning({ id: dishIngredients.id });
    if (!row) throw new NotFoundException("Ingrediente no encontrado");
  }

  /**
   * Sugerencias para asignar a un día. Para el scope=couple usa las stats
   * agregadas de los meal_plans de TODOS los miembros (lo planeado por cada
   * uno cuenta como "uso" del plato compartido).
   */
  async suggestions(
    userId: string,
    scope: RequestScope,
    mealType?: MealType,
    excludeDate?: string,
  ): Promise<DishSuggestion[]> {
    const ago30 = new Date();
    ago30.setUTCDate(ago30.getUTCDate() - 30);
    const ago30Str = ago30.toISOString().slice(0, 10);
    const ago7 = new Date();
    ago7.setUTCDate(ago7.getUTCDate() - 7);
    const ago7Str = ago7.toISOString().slice(0, 10);
    const ago14 = new Date();
    ago14.setUTCDate(ago14.getUTCDate() - 14);
    const ago14Str = ago14.toISOString().slice(0, 10);

    // Platos del scope activo
    const allDishes = await this.db
      .select()
      .from(dishes)
      .where(and(scopeCondition(userId, scope), isNull(dishes.deletedAt)));
    if (allDishes.length === 0) return [];

    // Users cuyos meal_plans cuentan para las stats
    const statsUserIds = await this.resolveMembers(userId, scope);

    const stats = await this.db
      .select({
        dishId: mealPlans.dishId,
        usesTotal: sql<number>`cast(count(*) as int)`,
        lastUsedOn: sql<string | null>`cast(max(${mealPlans.planDate}) as text)`,
        uses30: sql<number>`cast(sum(case when ${mealPlans.planDate} >= ${ago30Str} then 1 else 0 end) as int)`,
      })
      .from(mealPlans)
      .where(
        and(
          inArray(mealPlans.userId, statsUserIds),
          isNull(mealPlans.deletedAt),
          mealType ? eq(mealPlans.mealType, mealType) : undefined,
        ),
      )
      .groupBy(mealPlans.dishId);

    const statsByDish = new Map(
      stats
        .filter((s): s is typeof s & { dishId: string } => s.dishId !== null)
        .map((s) => [s.dishId, s]),
    );

    const result: DishSuggestion[] = allDishes.map((d) => {
      const s = statsByDish.get(d.id);
      const last = s?.lastUsedOn ?? null;
      const uses30 = s?.uses30 ?? 0;
      const usesTotal = s?.usesTotal ?? 0;

      let bucket: DishSuggestion["bucket"];
      if (!last) bucket = "never";
      else if (last < ago14Str) bucket = "stale";
      else if (last >= ago7Str) bucket = "recent";
      else if (uses30 >= 3) bucket = "favorite";
      else bucket = "stale";

      return {
        dish: toDish(d),
        bucket,
        last_used_on: last,
        uses_30d: uses30,
        uses_total: usesTotal,
      };
    });

    const order = { stale: 0, never: 1, favorite: 2, recent: 3 };
    result.sort((a, b) => {
      if (order[a.bucket] !== order[b.bucket])
        return order[a.bucket] - order[b.bucket];
      return b.uses_total - a.uses_total;
    });

    if (excludeDate) {
      // Excluir platos ya planeados por el ACTOR en esa fecha+meal_type
      // (no excluimos los del partner — uno puede comer lo mismo que el otro)
      const alreadyPlanned = await this.db
        .select({ dishId: mealPlans.dishId })
        .from(mealPlans)
        .where(
          and(
            eq(mealPlans.userId, userId),
            eq(mealPlans.planDate, excludeDate),
            mealType ? eq(mealPlans.mealType, mealType) : undefined,
            isNull(mealPlans.deletedAt),
          ),
        );
      const excluded = new Set(
        alreadyPlanned.map((p) => p.dishId).filter((id): id is string => !!id),
      );
      return result.filter((r) => !excluded.has(r.dish.id));
    }
    return result;
  }

  // ─── Internals ─────────────────────────────────────────────

  private async findById(
    userId: string,
    scope: RequestScope,
    id: string,
  ): Promise<Dish> {
    const [row] = await this.db
      .select()
      .from(dishes)
      .where(
        and(
          eq(dishes.id, id),
          scopeCondition(userId, scope),
          isNull(dishes.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Plato no encontrado");
    return toDish(row);
  }

  private async resolveMembers(
    userId: string,
    scope: RequestScope,
  ): Promise<string[]> {
    if (scope.kind === "personal") return [userId];
    const members = await this.db
      .select({ userId: coupleMembers.userId })
      .from(coupleMembers)
      .where(eq(coupleMembers.coupleId, scope.coupleId!));
    return members.map((m) => m.userId);
  }
}
