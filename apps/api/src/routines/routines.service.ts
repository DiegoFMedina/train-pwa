import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { rrulestr } from "rrule";
import type {
  CreateRoutine,
  MarkRoutineLog,
  Routine,
  RoutineLog,
  RoutineLogStatus,
  UpdateRoutine,
} from "@mi-centro/shared";
import { DB, type Db } from "../db/db.module";
import { routineLogs, routines } from "../db/schema";
import { toRoutine, toRoutineLog } from "./mappers";

export interface RoutineInstance {
  routine: Routine;
  due_on: string; // YYYY-MM-DD
  status: RoutineLogStatus;
  log_id: string | null;
}

@Injectable()
export class RoutinesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(userId: string): Promise<Routine[]> {
    const rows = await this.db
      .select()
      .from(routines)
      .where(and(eq(routines.userId, userId), isNull(routines.deletedAt)))
      .orderBy(asc(routines.timeOfDay));
    return rows.map(toRoutine);
  }

  async create(userId: string, input: CreateRoutine): Promise<Routine> {
    const [row] = await this.db
      .insert(routines)
      .values({
        ...(input.id ? { id: input.id } : {}),
        userId,
        title: input.title,
        notes: input.notes ?? null,
        rrule: input.rrule,
        timeOfDay: input.time_of_day,
        durationMinutes: input.duration_minutes ?? 30,
        notifyMode: input.notify_mode ?? "notify",
        active: input.active ?? true,
      })
      .returning();
    if (!row) throw new Error("INSERT routines no devolvió fila");
    return toRoutine(row);
  }

  async update(userId: string, id: string, patch: UpdateRoutine): Promise<Routine> {
    const updates: Partial<typeof routines.$inferInsert> = {};
    if (patch.title !== undefined) updates.title = patch.title;
    if (patch.notes !== undefined) updates.notes = patch.notes;
    if (patch.rrule !== undefined) updates.rrule = patch.rrule;
    if (patch.time_of_day !== undefined) updates.timeOfDay = patch.time_of_day;
    if (patch.duration_minutes !== undefined) updates.durationMinutes = patch.duration_minutes;
    if (patch.notify_mode !== undefined) updates.notifyMode = patch.notify_mode;
    if (patch.active !== undefined) updates.active = patch.active;

    if (Object.keys(updates).length === 0) {
      return this.findById(userId, id);
    }
    updates.updatedAt = new Date();

    const [row] = await this.db
      .update(routines)
      .set(updates)
      .where(
        and(
          eq(routines.id, id),
          eq(routines.userId, userId),
          isNull(routines.deletedAt),
        ),
      )
      .returning();
    if (!row) throw new NotFoundException("Rutina no encontrada");
    return toRoutine(row);
  }

  async softDelete(userId: string, id: string): Promise<void> {
    const [row] = await this.db
      .update(routines)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(routines.id, id),
          eq(routines.userId, userId),
          isNull(routines.deletedAt),
        ),
      )
      .returning({ id: routines.id });
    if (!row) throw new NotFoundException("Rutina no encontrada");
  }

  /**
   * Expande las rutinas activas del usuario contra una fecha (UTC date string
   * YYYY-MM-DD), devolviendo instancias con el log si existe.
   */
  async instancesForDate(userId: string, ymd: string): Promise<RoutineInstance[]> {
    const activeRoutines = await this.db
      .select()
      .from(routines)
      .where(
        and(
          eq(routines.userId, userId),
          eq(routines.active, true),
          isNull(routines.deletedAt),
        ),
      );

    const matching: Array<typeof routines.$inferSelect> = [];
    const start = new Date(`${ymd}T00:00:00Z`);
    const end = new Date(`${ymd}T23:59:59.999Z`);

    for (const r of activeRoutines) {
      if (occursOn(r.rrule, r.createdAt, start, end)) {
        matching.push(r);
      }
    }

    if (matching.length === 0) return [];

    const logs = await this.db
      .select()
      .from(routineLogs)
      .where(
        and(
          eq(routineLogs.userId, userId),
          eq(routineLogs.dueOn, ymd),
          isNull(routineLogs.deletedAt),
        ),
      );
    const logByRoutine = new Map(logs.map((l) => [l.routineId, l]));

    return matching
      .map((r) => {
        const log = logByRoutine.get(r.id);
        return {
          routine: toRoutine(r),
          due_on: ymd,
          status: (log?.status ?? "pending") as RoutineLogStatus,
          log_id: log?.id ?? null,
        };
      })
      .sort((a, b) =>
        a.routine.time_of_day.localeCompare(b.routine.time_of_day),
      );
  }

  /**
   * Upsert del log de una rutina para una fecha. Idempotente por
   * (routine_id, due_on) gracias al UNIQUE index.
   */
  async markLog(userId: string, input: MarkRoutineLog): Promise<RoutineLog> {
    // Verificar ownership de la rutina.
    await this.findById(userId, input.routine_id);

    const completedAt = input.status === "done" ? new Date() : null;
    const [row] = await this.db
      .insert(routineLogs)
      .values({
        userId,
        routineId: input.routine_id,
        dueOn: input.due_on,
        status: input.status,
        completedAt,
      })
      .onConflictDoUpdate({
        target: [routineLogs.routineId, routineLogs.dueOn],
        set: {
          status: input.status,
          completedAt,
          deletedAt: null,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!row) throw new Error("UPSERT routine_logs no devolvió fila");
    return toRoutineLog(row);
  }

  /**
   * Stats para una rutina en un rango de fechas. Calcula expected (cuántas
   * veces tocaba según RRULE), done, skipped, missed y current_streak.
   */
  async stats(
    userId: string,
    routineId: string,
    rangeFrom: string,
    rangeTo: string,
  ): Promise<{
    routine_id: string;
    range_from: string;
    range_to: string;
    expected: number;
    done: number;
    skipped: number;
    missed: number;
    completion_rate: number;
    current_streak: number;
  }> {
    const [r] = await this.db
      .select()
      .from(routines)
      .where(
        and(
          eq(routines.id, routineId),
          eq(routines.userId, userId),
          isNull(routines.deletedAt),
        ),
      )
      .limit(1);
    if (!r) throw new NotFoundException("Rutina no encontrada");

    const from = new Date(`${rangeFrom}T00:00:00Z`);
    const to = new Date(`${rangeTo}T23:59:59.999Z`);

    const dueDates = expandDates(r.rrule, r.createdAt, from, to);
    const expected = dueDates.length;

    const logs = await this.db
      .select()
      .from(routineLogs)
      .where(
        and(
          eq(routineLogs.routineId, routineId),
          gte(routineLogs.dueOn, rangeFrom),
          lte(routineLogs.dueOn, rangeTo),
          isNull(routineLogs.deletedAt),
        ),
      );
    const logsByDate = new Map(logs.map((l) => [dateString(new Date(`${l.dueOn}T00:00:00Z`)), l.status]));

    let done = 0, skipped = 0, missed = 0;
    const today = dateString(new Date());
    for (const d of dueDates) {
      const ymd = dateString(d);
      const status = logsByDate.get(ymd);
      if (status === "done") done++;
      else if (status === "skipped") skipped++;
      else if (ymd < today) missed++;
    }

    // Racha actual: contar días consecutivos hacia atrás con status=done.
    let current_streak = 0;
    for (let i = dueDates.length - 1; i >= 0; i--) {
      const ymd = dateString(dueDates[i]!);
      if (logsByDate.get(ymd) === "done") current_streak++;
      else break;
    }

    return {
      routine_id: routineId,
      range_from: rangeFrom,
      range_to: rangeTo,
      expected,
      done,
      skipped,
      missed,
      completion_rate: expected > 0 ? done / expected : 0,
      current_streak,
    };
  }

  private async findById(userId: string, id: string): Promise<Routine> {
    const [row] = await this.db
      .select()
      .from(routines)
      .where(
        and(
          eq(routines.id, id),
          eq(routines.userId, userId),
          isNull(routines.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Rutina no encontrada");
    return toRoutine(row);
  }
}

/**
 * `true` si la rrule cae en el rango [from, to). `dtstart` se usa como
 * ancla — por defecto tomamos `createdAt` de la rutina.
 */
function occursOn(rruleStr: string, dtstart: Date, from: Date, to: Date): boolean {
  try {
    const rule = rrulestr(rruleStr, {
      dtstart: anchorMidnightUTC(dtstart),
    });
    return rule.between(from, to, true).length > 0;
  } catch {
    return false;
  }
}

function expandDates(rruleStr: string, dtstart: Date, from: Date, to: Date): Date[] {
  try {
    const rule = rrulestr(rruleStr, {
      dtstart: anchorMidnightUTC(dtstart),
    });
    return rule.between(from, to, true);
  } catch {
    return [];
  }
}

function anchorMidnightUTC(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

function dateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}
