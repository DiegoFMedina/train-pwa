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
   * en el rango [from, to]. Estrategia:
   *   - Agrupa por (lower(name), unit). Si dos ingredientes coinciden en
   *     nombre+unidad, suma sus amount.
   *   - Si amount es NULL (legacy o "al gusto"), cae al texto libre quantity
   *     en el display, concatenando con " + ".
   */
  async shoppingList(
    userId: string,
    from: string,
    to: string,
  ): Promise<ShoppingList> {
    const rows = await this.db
      .select({
        ingredientName: dishIngredients.name,
        amount: dishIngredients.amount,
        unit: dishIngredients.unit,
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

    interface Bucket {
      name: string;
      unit: string | null;
      amountSum: number | null;
      legacyParts: string[];
      occurrences: number;
      dishes: Set<string>;
    }

    const byKey = new Map<string, Bucket>();
    for (const r of rows) {
      const normalized = r.ingredientName.trim();
      const unit = (r.unit ?? "").trim().toLowerCase() || null;
      const key = `${normalized.toLowerCase()}|${unit ?? ""}`;
      let bucket = byKey.get(key);
      if (!bucket) {
        bucket = {
          name: normalized,
          unit,
          amountSum: null,
          legacyParts: [],
          occurrences: 0,
          dishes: new Set(),
        };
        byKey.set(key, bucket);
      }
      bucket.occurrences++;
      bucket.dishes.add(r.dishName);

      if (r.amount !== null) {
        const n = Number(r.amount);
        bucket.amountSum = (bucket.amountSum ?? 0) + n;
      } else if (r.quantity && r.quantity.trim()) {
        bucket.legacyParts.push(r.quantity.trim());
      }
    }

    const items: ShoppingListItem[] = Array.from(byKey.values())
      .map((b) => {
        const display = formatDisplay(b);
        return {
          name: b.name,
          amount: b.amountSum,
          unit: b.unit,
          display,
          occurrences: b.occurrences,
          dishes: Array.from(b.dishes).sort(),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "es"));

    return { from, to, items };
  }

  /**
   * Comidas en rango. Sirve para la vista calendario mensual.
   */
  async listInRange(
    userId: string,
    from: string,
    to: string,
  ): Promise<MealPlan[]> {
    const rows = await this.db
      .select()
      .from(mealPlans)
      .where(
        and(
          eq(mealPlans.userId, userId),
          gte(mealPlans.planDate, from),
          lte(mealPlans.planDate, to),
          isNull(mealPlans.deletedAt),
        ),
      )
      .orderBy(asc(mealPlans.planDate), asc(mealPlans.mealType));
    return rows.map(toMealPlan);
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

/** Formato de display amigable según la mezcla de datos en el bucket. */
function formatDisplay(b: {
  unit: string | null;
  amountSum: number | null;
  legacyParts: string[];
  occurrences: number;
}): string {
  const parts: string[] = [];

  if (b.amountSum !== null && b.unit) {
    parts.push(`${formatAmount(b.amountSum)} ${b.unit}`);
  } else if (b.amountSum !== null) {
    parts.push(formatAmount(b.amountSum));
  }

  if (b.legacyParts.length > 0) {
    parts.push(b.legacyParts.join(" + "));
  }

  if (parts.length === 0) return `× ${b.occurrences}`;
  return parts.join(" + ");
}

/** Quita decimales innecesarios: 1.500 → "1.5", 2.000 → "2". */
function formatAmount(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return Number(n.toFixed(3))
    .toString()
    .replace(/\.?0+$/, "");
}
