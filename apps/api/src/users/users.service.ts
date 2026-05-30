import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type {
  UpdateUserPreferences,
  User as SharedUser,
} from "@mi-centro/shared";
import { DB, type Db } from "../db/db.module";
import { users } from "../db/schema";

@Injectable()
export class UsersService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async findById(userId: string): Promise<SharedUser> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!row) throw new NotFoundException("Usuario no encontrado");
    return toSharedUser(row);
  }

  async updatePreferences(
    userId: string,
    patch: UpdateUserPreferences,
  ): Promise<SharedUser> {
    const updates: Partial<typeof users.$inferInsert> = {};
    if (patch.timezone !== undefined) updates.timezone = patch.timezone;
    if (patch.language !== undefined) updates.language = patch.language;
    if (patch.theme !== undefined) updates.theme = patch.theme;
    if (patch.default_currency !== undefined) updates.defaultCurrency = patch.default_currency;
    if (patch.quiet_hours_start !== undefined) updates.quietHoursStart = patch.quiet_hours_start;
    if (patch.quiet_hours_end !== undefined) updates.quietHoursEnd = patch.quiet_hours_end;

    if (Object.keys(updates).length === 0) return this.findById(userId);

    updates.updatedAt = new Date();
    const [row] = await this.db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();
    if (!row) throw new NotFoundException("Usuario no encontrado");
    return toSharedUser(row);
  }
}

function toSharedUser(row: typeof users.$inferSelect): SharedUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    timezone: row.timezone,
    language: row.language as SharedUser["language"],
    theme: row.theme as SharedUser["theme"],
    default_currency: row.defaultCurrency,
    quiet_hours_start: row.quietHoursStart,
    quiet_hours_end: row.quietHoursEnd,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}
