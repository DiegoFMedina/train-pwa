import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import type {
  CreateMealPlan,
  MealPlan,
  ShoppingList,
  ShoppingListItem,
  UpdateMealPlan,
} from "@mi-centro/shared";
import type { RequestScope } from "../common/scope";
import { DB, type Db } from "../db/db.module";
import {
  coupleMembers,
  dishIngredients,
  dishes,
  mealPlans,
  users,
} from "../db/schema";
import { toMealPlan } from "./mappers";

@Injectable()
export class MealPlansService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Meal plans de un día.
   *   - personal: solo los del user
   *   - couple:   los de TODOS los miembros (cada uno los suyos), con user_name denormalizado
   */
  async listForDay(
    userId: string,
    scope: RequestScope,
    date: string,
  ): Promise<MealPlan[]> {
    const userIds = await this.resolveMembers(userId, scope);
    const rows = await this.db
      .select({ p: mealPlans, u: { name: users.name } })
      .from(mealPlans)
      .innerJoin(users, eq(users.id, mealPlans.userId))
      .where(
        and(
          inArray(mealPlans.userId, userIds),
          eq(mealPlans.planDate, date),
          isNull(mealPlans.deletedAt),
        ),
      )
      .orderBy(asc(mealPlans.cookTime));
    return rows.map((r) =>
      toMealPlan(r.p, scope.kind === "couple" ? r.u.name : undefined),
    );
  }

  async listInRange(
    userId: string,
    scope: RequestScope,
    from: string,
    to: string,
  ): Promise<MealPlan[]> {
    const userIds = await this.resolveMembers(userId, scope);
    const rows = await this.db
      .select({ p: mealPlans, u: { name: users.name } })
      .from(mealPlans)
      .innerJoin(users, eq(users.id, mealPlans.userId))
      .where(
        and(
          inArray(mealPlans.userId, userIds),
          gte(mealPlans.planDate, from),
          lte(mealPlans.planDate, to),
          isNull(mealPlans.deletedAt),
        ),
      )
      .orderBy(asc(mealPlans.planDate), asc(mealPlans.mealType));
    return rows.map((r) =>
      toMealPlan(r.p, scope.kind === "couple" ? r.u.name : undefined),
    );
  }

  /** Crear siempre asigna user_id = actor. No se "comparte" un meal_plan. */
  async create(
    userId: string,
    _scope: RequestScope,
    input: CreateMealPlan,
  ): Promise<MealPlan> {
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

  /** Update/delete: solo el owner (user_id = actor), aunque sea scope=couple. */
  async update(
    userId: string,
    scope: RequestScope,
    id: string,
    patch: UpdateMealPlan,
  ): Promise<MealPlan> {
    await this.assertOwnerAccessible(userId, scope, id);

    const updates: Partial<typeof mealPlans.$inferInsert> = {};
    if (patch.dish_id !== undefined) updates.dishId = patch.dish_id;
    if (patch.plan_date !== undefined) updates.planDate = patch.plan_date;
    if (patch.meal_type !== undefined) updates.mealType = patch.meal_type;
    if (patch.cook_time !== undefined) updates.cookTime = patch.cook_time;
    if (patch.eat_time !== undefined) updates.eatTime = patch.eat_time;
    if (patch.notify_mode !== undefined) updates.notifyMode = patch.notify_mode;
    if (patch.status !== undefined) updates.status = patch.status;

    if (Object.keys(updates).length === 0) {
      return this.findOwnById(userId, id);
    }
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

  async softDelete(
    userId: string,
    scope: RequestScope,
    id: string,
  ): Promise<void> {
    await this.assertOwnerAccessible(userId, scope, id);
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
   * Lista de compras agregada.
   *   - personal: ingredientes de los meal_plans del user
   *   - couple:   ingredientes de los meal_plans de ambos members (combinado)
   * En cualquier modo agrupa por (lower(name), unit) y suma amount.
   */
  async shoppingList(
    userId: string,
    scope: RequestScope,
    from: string,
    to: string,
  ): Promise<ShoppingList> {
    const userIds = await this.resolveMembers(userId, scope);
    // El dish debe pertenecer al scope activo para entrar a la lista:
    // - personal: dish.couple_id IS NULL
    // - couple:   dish.couple_id = scope.coupleId
    const dishScopeFilter =
      scope.kind === "personal"
        ? isNull(dishes.coupleId)
        : eq(dishes.coupleId, scope.coupleId!);

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
          inArray(mealPlans.userId, userIds),
          gte(mealPlans.planDate, from),
          lte(mealPlans.planDate, to),
          isNull(mealPlans.deletedAt),
          isNull(dishes.deletedAt),
          dishScopeFilter,
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
        bucket.amountSum = (bucket.amountSum ?? 0) + Number(r.amount);
      } else if (r.quantity && r.quantity.trim()) {
        bucket.legacyParts.push(r.quantity.trim());
      }
    }

    const items: ShoppingListItem[] = Array.from(byKey.values())
      .map((b) => ({
        name: b.name,
        amount: b.amountSum,
        unit: b.unit,
        display: formatDisplay(b),
        occurrences: b.occurrences,
        dishes: Array.from(b.dishes).sort(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));

    return { from, to, items };
  }

  // ─── Internals ─────────────────────────────────────────────

  /**
   * Verifica que el meal_plan existe Y que el actor puede modificarlo.
   *   - En personal: existe + es del user
   *   - En couple:   existe + (es del user O es de otro member de la pareja, pero
   *                  para ESCRIBIR exigimos que sea del user mismo).
   * Tira ForbiddenException si trata de tocar el plan del partner.
   */
  private async assertOwnerAccessible(
    userId: string,
    scope: RequestScope,
    id: string,
  ): Promise<void> {
    const [row] = await this.db
      .select({ userId: mealPlans.userId })
      .from(mealPlans)
      .where(and(eq(mealPlans.id, id), isNull(mealPlans.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundException("Comida no encontrada");
    if (row.userId === userId) return;
    // Si no es el actor: en personal es 404, en couple es 403 (sí es accesible
    // para leer pero no para escribir)
    if (scope.kind === "couple") {
      const members = await this.resolveMembers(userId, scope);
      if (members.includes(row.userId)) {
        throw new ForbiddenException(
          "Solo el dueño puede editar/borrar este plan",
        );
      }
    }
    throw new NotFoundException("Comida no encontrada");
  }

  private async findOwnById(userId: string, id: string): Promise<MealPlan> {
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

function formatAmount(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return Number(n.toFixed(3)).toString().replace(/\.?0+$/, "");
}
