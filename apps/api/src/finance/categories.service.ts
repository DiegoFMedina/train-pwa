import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq, isNull, type SQL } from "drizzle-orm";
import type {
  Category,
  CreateCategory,
  UpdateCategory,
} from "@mi-centro/shared";
import type { RequestScope } from "../common/scope";
import { DB, type Db } from "../db/db.module";
import { categories } from "../db/schema";
import { toCategory } from "./mappers";

/** Condición SQL que filtra entidades según el scope activo. */
function scopeCondition(userId: string, scope: RequestScope): SQL | undefined {
  if (scope.kind === "personal") {
    return and(
      eq(categories.userId, userId),
      isNull(categories.coupleId),
    );
  }
  return eq(categories.coupleId, scope.coupleId!);
}

@Injectable()
export class CategoriesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(userId: string, scope: RequestScope): Promise<Category[]> {
    const rows = await this.db
      .select()
      .from(categories)
      .where(
        and(scopeCondition(userId, scope), isNull(categories.deletedAt)),
      )
      .orderBy(asc(categories.name));
    return rows.map(toCategory);
  }

  async create(
    userId: string,
    scope: RequestScope,
    input: CreateCategory,
  ): Promise<Category> {
    const [row] = await this.db
      .insert(categories)
      .values({
        ...(input.id ? { id: input.id } : {}),
        userId,
        coupleId: scope.coupleId,
        name: input.name,
        kind: input.kind,
        color: input.color ?? null,
        icon: input.icon ?? null,
      })
      .returning();
    if (!row) throw new Error("INSERT categories no devolvió fila");
    return toCategory(row);
  }

  async update(
    userId: string,
    scope: RequestScope,
    id: string,
    patch: UpdateCategory,
  ): Promise<Category> {
    const updates: Partial<typeof categories.$inferInsert> = {};
    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.kind !== undefined) updates.kind = patch.kind;
    if (patch.color !== undefined) updates.color = patch.color;
    if (patch.icon !== undefined) updates.icon = patch.icon;

    if (Object.keys(updates).length === 0) {
      return this.findById(userId, scope, id);
    }
    updates.updatedAt = new Date();

    const [row] = await this.db
      .update(categories)
      .set(updates)
      .where(
        and(
          eq(categories.id, id),
          scopeCondition(userId, scope),
          isNull(categories.deletedAt),
        ),
      )
      .returning();
    if (!row) throw new NotFoundException("Categoría no encontrada");
    return toCategory(row);
  }

  async softDelete(
    userId: string,
    scope: RequestScope,
    id: string,
  ): Promise<void> {
    const [row] = await this.db
      .update(categories)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(categories.id, id),
          scopeCondition(userId, scope),
          isNull(categories.deletedAt),
        ),
      )
      .returning({ id: categories.id });
    if (!row) throw new NotFoundException("Categoría no encontrada");
  }

  private async findById(
    userId: string,
    scope: RequestScope,
    id: string,
  ): Promise<Category> {
    const [row] = await this.db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.id, id),
          scopeCondition(userId, scope),
          isNull(categories.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Categoría no encontrada");
    return toCategory(row);
  }
}
