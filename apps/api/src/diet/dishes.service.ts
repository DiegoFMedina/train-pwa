import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq, isNull } from "drizzle-orm";
import type {
  CreateDish,
  CreateDishIngredient,
  Dish,
  DishIngredient,
  UpdateDish,
} from "@mi-centro/shared";
import { DB, type Db } from "../db/db.module";
import { dishes, dishIngredients } from "../db/schema";
import { toDish, toIngredient } from "./mappers";

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
