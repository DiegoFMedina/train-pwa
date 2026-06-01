import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, desc, eq, gte, isNull, sql } from "drizzle-orm";
import type {
  CreateDish,
  CreateDishIngredient,
  Dish,
  DishIngredient,
  MealType,
  UpdateDish,
} from "@mi-centro/shared";
import { DB, type Db } from "../db/db.module";
import { dishes, dishIngredients, mealPlans } from "../db/schema";
import { toDish, toIngredient } from "./mappers";

export interface DishSuggestion {
  dish: Dish;
  bucket: "stale" | "favorite" | "recent" | "never";
  last_used_on: string | null;
  uses_30d: number;
  uses_total: number;
}

@Injectable()
export class DishesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(userId: string): Promise<Dish[]> {
    const rows = await this.db
      .select()
      .from(dishes)
      .where(and(eq(dishes.userId, userId), isNull(dishes.deletedAt)))
      .orderBy(asc(dishes.name));
    return rows.map(toDish);
  }

  async create(userId: string, input: CreateDish): Promise<Dish> {
    const [row] = await this.db
      .insert(dishes)
      .values({
        ...(input.id ? { id: input.id } : {}),
        userId,
        name: input.name,
        notes: input.notes ?? null,
        prepMinutes: input.prep_minutes ?? null,
      })
      .returning();
    if (!row) throw new Error("INSERT dishes no devolvió fila");
    return toDish(row);
  }

  async update(userId: string, id: string, patch: UpdateDish): Promise<Dish> {
    const updates: Partial<typeof dishes.$inferInsert> = {};
    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.notes !== undefined) updates.notes = patch.notes;
    if (patch.prep_minutes !== undefined) updates.prepMinutes = patch.prep_minutes;

    if (Object.keys(updates).length === 0) return this.findById(userId, id);
    updates.updatedAt = new Date();

    const [row] = await this.db
      .update(dishes)
      .set(updates)
      .where(
        and(
          eq(dishes.id, id),
          eq(dishes.userId, userId),
          isNull(dishes.deletedAt),
        ),
      )
      .returning();
    if (!row) throw new NotFoundException("Plato no encontrado");
    return toDish(row);
  }

  async softDelete(userId: string, id: string): Promise<void> {
    const [row] = await this.db
      .update(dishes)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(dishes.id, id),
          eq(dishes.userId, userId),
          isNull(dishes.deletedAt),
        ),
      )
      .returning({ id: dishes.id });
    if (!row) throw new NotFoundException("Plato no encontrado");
  }

  async listIngredients(userId: string, dishId: string): Promise<DishIngredient[]> {
    await this.findById(userId, dishId);
    const rows = await this.db
      .select()
      .from(dishIngredients)
      .where(
        and(
          eq(dishIngredients.userId, userId),
          eq(dishIngredients.dishId, dishId),
          isNull(dishIngredients.deletedAt),
        ),
      )
      .orderBy(asc(dishIngredients.name));
    return rows.map(toIngredient);
  }

  async addIngredient(
    userId: string,
    dishId: string,
    input: Omit<CreateDishIngredient, "dish_id">,
  ): Promise<DishIngredient> {
    await this.findById(userId, dishId);
    const [row] = await this.db
      .insert(dishIngredients)
      .values({
        ...(input.id ? { id: input.id } : {}),
        userId,
        dishId,
        name: input.name,
        amount: input.amount !== undefined && input.amount !== null
          ? input.amount.toFixed(3)
          : null,
        unit: input.unit ?? null,
        quantity: input.quantity ?? null,
      })
      .returning();
    if (!row) throw new Error("INSERT dish_ingredients no devolvió fila");
    return toIngredient(row);
  }

  async removeIngredient(userId: string, dishId: string, ingredientId: string): Promise<void> {
    const [row] = await this.db
      .update(dishIngredients)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(dishIngredients.id, ingredientId),
          eq(dishIngredients.dishId, dishId),
          eq(dishIngredients.userId, userId),
          isNull(dishIngredients.deletedAt),
        ),
      )
      .returning({ id: dishIngredients.id });
    if (!row) throw new NotFoundException("Ingrediente no encontrado");
  }

  /**
   * Sugerencias de plato para asignar a un día. Estrategia:
   *   - "stale"    → plato que no se usa hace 14+ días (prioridad: variar)
   *   - "favorite" → ≥3 usos en últimos 30 días (rotación natural)
   *   - "recent"   → usado en últimos 7 días (repetir si gustó)
   *   - "never"    → plato sin meal_plan jamás
   * Ordena: stale > never > favorite > recent. Dentro de cada bucket,
   * ordena por uses_total desc (los más establecidos primero).
   */
  async suggestions(
    userId: string,
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

    // Una sola query con CTEs sería ideal, pero mantengo dos lecturas para legibilidad:
    // 1) Todos los platos del usuario
    // 2) Stats de uso (last_used_on + uses_30d + uses_total) por plato
    const allDishes = await this.db
      .select()
      .from(dishes)
      .where(and(eq(dishes.userId, userId), isNull(dishes.deletedAt)));

    if (allDishes.length === 0) return [];

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
          eq(mealPlans.userId, userId),
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
      if (order[a.bucket] !== order[b.bucket]) return order[a.bucket] - order[b.bucket];
      return b.uses_total - a.uses_total;
    });

    // Excluir solo los platos ya planeados en la fecha+meal_type que el
    // usuario está armando ahora (si pasó excludeDate). Antes filtrábamos
    // por "today" globalmente, lo que ocultaba un plato cocinado hoy de
    // las sugerencias para CUALQUIER otra fecha — un bug.
    if (excludeDate) {
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

  private async findById(userId: string, id: string): Promise<Dish> {
    const [row] = await this.db
      .select()
      .from(dishes)
      .where(
        and(
          eq(dishes.id, id),
          eq(dishes.userId, userId),
          isNull(dishes.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Plato no encontrado");
    return toDish(row);
  }
}
