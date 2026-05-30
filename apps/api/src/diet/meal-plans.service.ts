import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import type {
  CreateMealPlan,
  MealPlan,
  ShoppingList,
  ShoppingListItem,
  UpdateMealPlan,
} from "@mi-centro/shared";
import { DB, type Db } from "../db/db.module";
import { dishIngredients, dishes, mealPlans } from "../db/schema";
import { toMealPlan } from "./mappers";

@Injectable()
export class MealPlansService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async listForDay(userId: string, date: string): Promise<MealPlan[]> {
    const rows = await this.db
      .select()
      .from(mealPlans)
      .where(
        and(
          eq(mealPlans.userId, userId),
          eq(mealPlans.planDate, date),
          isNull(mealPlans.deletedAt),
        ),
      )
      .orderBy(asc(mealPlans.cookTime));
    return rows.map(toMealPlan);
  }

  async create(userId: string, input: CreateMealPlan): Promise<MealPlan> {
    const [row] = await this.db
      .insert(mealPlans)
      .values({
        ...(input.id ? { id: input.id } : {}),
        userId,
        dishId: input.dish_id ?? null,
        planDate: input.plan_date,
        mealType: input.meal_type,
        cookTime: input.cook_time ?? null,
        eatTime: input.eat_time ?? null,
        notifyMode: input.notify_mode ?? "notify",
        status: input.status ?? "planned",
      })
      .returning();
    if (!row) throw new Error("INSERT meal_plans no devolvió fila");
    return toMealPlan(row);
  }

  async update(
    userId: string,
    id: string,
    patch: UpdateMealPlan,
  ): Promise<MealPlan> {
    const updates: Partial<typeof mealPlans.$inferInsert> = {};
    if (patch.dish_id !== undefined) updates.dishId = patch.dish_id;
    if (patch.plan_date !== undefined) updates.planDate = patch.plan_date;
    if (patch.meal_type !== undefined) updates.mealType = patch.meal_type;
    if (patch.cook_time !== undefined) updates.cookTime = patch.cook_time;
    if (patch.eat_time !== undefined) updates.eatTime = patch.eat_time;
    if (patch.notify_mode !== undefined) updates.notifyMode = patch.notify_mode;
    if (patch.status !== undefined) updates.status = patch.status;

    if (Object.keys(updates).length === 0) return this.findById(userId, id);
    updates.updatedAt = new Date();

    const [row] = await this.db
      .update(mealPlans)
      .set(updates)
      .where(
        and(
          eq(mealPlans.id, id),
          eq(mealPlans.userId, userId),
          isNull(mealPlans.deletedAt),
        ),
      )
      .returning();
    if (!row) throw new NotFoundException("Comida no encontrada");
    return toMealPlan(row);
  }

  async softDelete(userId: string, id: string): Promise<void> {
    const [row] = await this.db
      .update(mealPlans)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(mealPlans.id, id),
          eq(mealPlans.userId, userId),
          isNull(mealPlans.deletedAt),
        ),
      )
      .returning({ id: mealPlans.id });
    if (!row) throw new NotFoundException("Comida no encontrada");
  }

  /**
   * Lista de compras agregada: todos los ingredientes de los platos planeados
   * en el rango [from, to]. Agrupa por nombre + cantidad (texto libre,
   * concatena para que el usuario decida en el super).
   */
  async shoppingList(
    userId: string,
    from: string,
    to: string,
  ): Promise<ShoppingList> {
    const rows = await this.db
      .select({
        ingredientName: dishIngredients.name,
        quantity: dishIngredients.quantity,
        dishName: dishes.name,
      })
      .from(mealPlans)
      .innerJoin(dishes, eq(dishes.id, mealPlans.dishId))
      .innerJoin(
        dishIngredients,
        and(
          eq(dishIngredients.dishId, dishes.id),
          isNull(dishIngredients.deletedAt),
        ),
      )
      .where(
        and(
          eq(mealPlans.userId, userId),
          gte(mealPlans.planDate, from),
          lte(mealPlans.planDate, to),
          isNull(mealPlans.deletedAt),
          isNull(dishes.deletedAt),
        ),
      );

    const byKey = new Map<
      string,
      { name: string; quantities: string[]; dishes: Set<string> }
    >();
    for (const r of rows) {
      const key = r.ingredientName.toLowerCase();
      const existing = byKey.get(key);
      if (existing) {
        if (r.quantity) existing.quantities.push(r.quantity);
        existing.dishes.add(r.dishName);
      } else {
        byKey.set(key, {
          name: r.ingredientName,
          quantities: r.quantity ? [r.quantity] : [],
          dishes: new Set([r.dishName]),
        });
      }
    }

    const items: ShoppingListItem[] = Array.from(byKey.values())
      .map((v) => ({
        name: v.name,
        quantity: v.quantities.length > 0 ? v.quantities.join(" + ") : null,
        dishes: Array.from(v.dishes).sort(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { from, to, items };
  }

  private async findById(userId: string, id: string): Promise<MealPlan> {
    const [row] = await this.db
      .select()
      .from(mealPlans)
      .where(
        and(
          eq(mealPlans.id, id),
          eq(mealPlans.userId, userId),
          isNull(mealPlans.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Comida no encontrada");
    return toMealPlan(row);
  }
}
