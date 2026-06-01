import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq, gte, inArray, isNull, lte, type SQL } from "drizzle-orm";
import { rrulestr } from "rrule";
import type {
  CreateRoutine,
  MarkRoutineLog,
  Routine,
  RoutineLog,
  RoutineLogStatus,
  UpdateRoutine,
} from "@mi-centro/shared";
import type { RequestScope } from "../common/scope";
import { DB, type Db } from "../db/db.module";
import { coupleMembers, routineLogs, routines, users } from "../db/schema";
import { toRoutine, toRoutineLog } from "./mappers";

/**
 * Estado de cumplimiento de UNA rutina, para UN miembro, en UN día.
 * En scope personal, members tiene 1 entrada (el current user).
 * En scope couple, members tiene 1 entrada por cada miembro de la pareja.
 */
export interface RoutineInstance {
  routine: Routine;
  due_on: string;
  members: Array<{
    user_id: string;
    user_name: string;
    status: RoutineLogStatus;
    log_id: string | null;
  }>;
}

function scopeCondition(userId: string, scope: RequestScope): SQL | undefined {
  if (scope.kind === "personal") {
    return and(eq(routines.userId, userId), isNull(routines.coupleId));
  }
  return eq(routines.coupleId, scope.coupleId!);
}

@Injectable()
export class RoutinesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(userId: string, scope: RequestScope): Promise<Routine[]> {
    const rows = await this.db
      .select()
      .from(routines)
      .where(and(scopeCondition(userId, scope), isNull(routines.deletedAt)))
      .orderBy(asc(routines.timeOfDay));
    return rows.map(toRoutine);
  }

  async create(
    userId: string,
    scope: RequestScope,
    input: CreateRoutine,
  ): Promise<Routine> {
    const [row] = await this.db
      .insert(routines)
      .values({
        ...(input.id ? { id: input.id } : {}),
        userId,
        coupleId: scope.coupleId,
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

  async update(
    userId: string,
    scope: RequestScope,
    id: string,
    patch: UpdateRoutine,
  ): Promise<Routine> {
    const updates: Partial<typeof routines.$inferInsert> = {};
    if (patch.title !== undefined) updates.title = patch.title;
    if (patch.notes !== undefined) updates.notes = patch.notes;
    if (patch.rrule !== undefined) updates.rrule = patch.rrule;
    if (patch.time_of_day !== undefined) updates.timeOfDay = patch.time_of_day;
    if (patch.duration_minutes !== undefined)
      updates.durationMinutes = patch.duration_minutes;
    if (patch.notify_mode !== undefined)
      updates.notifyMode = patch.notify_mode;
    if (patch.active !== undefined) updates.active = patch.active;

    if (Object.keys(updates).length === 0) {
      return this.findById(userId, scope, id);
    }
    updates.updatedAt = new Date();

    const [row] = await this.db
      .update(routines)
      .set(updates)
      .where(
        and(
          eq(routines.id, id),
          scopeCondition(userId, scope),
          isNull(routines.deletedAt),
        ),
      )
      .returning();
    if (!row) throw new NotFoundException("Rutina no encontrada");
    return toRoutine(row);
  }

  async softDelete(
    userId: string,
    scope: RequestScope,
    id: string,
  ): Promise<void> {
    const [row] = await this.db
      .update(routines)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(routines.id, id),
          scopeCondition(userId, scope),
          isNull(routines.deletedAt),
        ),
      )
      .returning({ id: routines.id });
    if (!row) throw new NotFoundException("Rutina no encontrada");
  }

  /**
   * Instancias del día: rutinas que caen + estado por miembro.
   * En scope couple devuelve el log de cada miembro de la pareja.
   */
  async instancesForDate(
    userId: string,
    scope: RequestScope,
    ymd: string,
  ): Promise<RoutineInstance[]> {
    const activeRoutines = await this.db
      .select()
      .from(routines)
      .where(
        and(
          scopeCondition(userId, scope),
          eq(routines.active, true),
          isNull(routines.deletedAt),
        ),
      );

    if (activeRoutines.length === 0) return [];

    // Calcular qué rutinas caen en el día con expansión RRULE
    const start = new Date(`${ymd}T00:00:00Z`);
    const end = new Date(`${ymd}T23:59:59.999Z`);
    const matching = activeRoutines.filter((r) =>
      occursOn(r.rrule, r.createdAt, start, end),
    );
    if (matching.length === 0) return [];

    // Determinar qué users mostrar
    const memberIds = await this.resolveMembers(userId, scope);
    const memberUsers = await this.db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, memberIds));
    const memberById = new Map(memberUsers.map((m) => [m.id, m]));

    // Logs del día para esos users
    const logs = await this.db
      .select()
      .from(routineLogs)
      .where(
        and(
          inArray(routineLogs.userId, memberIds),
          eq(routineLogs.dueOn, ymd),
          isNull(routineLogs.deletedAt),
        ),
      );
    // Map: routineId -> userId -> log
    const logByRoutineUser = new Map<string, Map<string, typeof logs[number]>>();
    for (const l of logs) {
      let byUser = logByRoutineUser.get(l.routineId);
      if (!byUser) {
        byUser = new Map();
        logByRoutineUser.set(l.routineId, byUser);
      }
      byUser.set(l.userId, l);
    }

    return matching
      .map((r) => {
        const byUser = logByRoutineUser.get(r.id);
        return {
          routine: toRoutine(r),
          due_on: ymd,
          members: memberIds.map((uid) => {
            const log = byUser?.get(uid);
            return {
              user_id: uid,
              user_name: memberById.get(uid)?.name ?? "?",
              status: (log?.status ?? "pending") as RoutineLogStatus,
              log_id: log?.id ?? null,
            };
          }),
        };
      })
      .sort((a, b) =>
        a.routine.time_of_day.localeCompare(b.routine.time_of_day),
      );
  }

  /**
   * Marcar el log de UNA rutina para UN día. Siempre el log se crea con
   * el user_id del actor — cada miembro marca su propio cumplimiento.
   */
  async markLog(
    userId: string,
    scope: RequestScope,
    input: MarkRoutineLog,
  ): Promise<RoutineLog> {
    // Verificar acceso a la rutina (scope)
    await this.findById(userId, scope, input.routine_id);

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
        target: [routineLogs.routineId, routineLogs.userId, routineLogs.dueOn],
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
   * Stats de cumplimiento. En scope couple devuelve un array (uno por miembro).
   * En scope personal devuelve un solo elemento (el current user).
   */
  async stats(
    userId: string,
    scope: RequestScope,
    routineId: string,
    rangeFrom: string,
    rangeTo: string,
  ): Promise<
    Array<{
      user_id: string;
      user_name: string;
      routine_id: string;
      range_from: string;
      range_to: string;
      expected: number;
      done: number;
      skipped: number;
      missed: number;
      completion_rate: number;
      current_streak: number;
    }>
  > {
    const [r] = await this.db
      .select()
      .from(routines)
      .where(
        and(
          eq(routines.id, routineId),
          scopeCondition(userId, scope),
          isNull(routines.deletedAt),
        ),
      )
      .limit(1);
    if (!r) throw new NotFoundException("Rutina no encontrada");

    const from = new Date(`${rangeFrom}T00:00:00Z`);
    const to = new Date(`${rangeTo}T23:59:59.999Z`);
    const dueDates = expandDates(r.rrule, r.createdAt, from, to);
    const expected = dueDates.length;
    const today = dateString(new Date());

    const memberIds = await this.resolveMembers(userId, scope);
    const memberUsers = await this.db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, memberIds));
    const nameById = new Map(memberUsers.map((m) => [m.id, m.name]));

    const allLogs = await this.db
      .select()
      .from(routineLogs)
      .where(
        and(
          eq(routineLogs.routineId, routineId),
          inArray(routineLogs.userId, memberIds),
          gte(routineLogs.dueOn, rangeFrom),
          lte(routineLogs.dueOn, rangeTo),
          isNull(routineLogs.deletedAt),
        ),
      );

    return memberIds.map((uid) => {
      const userLogs = allLogs.filter((l) => l.userId === uid);
      const logsByDate = new Map(
        userLogs.map((l) => [
          dateString(new Date(`${l.dueOn}T00:00:00Z`)),
          l.status,
        ]),
      );
      let done = 0,
        skipped = 0,
        missed = 0;
      for (const d of dueDates) {
        const ymd = dateString(d);
        const status = logsByDate.get(ymd);
        if (status === "done") done++;
        else if (status === "skipped") skipped++;
        else if (ymd < today) missed++;
      }
      let current_streak = 0;
      for (let i = dueDates.length - 1; i >= 0; i--) {
        const ymd = dateString(dueDates[i]!);
        if (logsByDate.get(ymd) === "done") current_streak++;
        else break;
      }
      return {
        user_id: uid,
        user_name: nameById.get(uid) ?? "?",
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
    });
  }

  // ─── Internals ─────────────────────────────────────────────

  private async findById(
    userId: string,
    scope: RequestScope,
    id: string,
  ): Promise<Routine> {
    const [row] = await this.db
      .select()
      .from(routines)
      .where(
        and(
          eq(routines.id, id),
          scopeCondition(userId, scope),
          isNull(routines.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Rutina no encontrada");
    return toRoutine(row);
  }

  /** Devuelve los user_ids que tienen acceso al scope (solo el user en personal). */
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

function occursOn(rruleStr: string, dtstart: Date, from: Date, to: Date): boolean {
  try {
    const rule = rrulestr(rruleStr, { dtstart: anchorMidnightUTC(dtstart) });
    return rule.between(from, to, true).length > 0;
  } catch {
    return false;
  }
}

function expandDates(
  rruleStr: string,
  dtstart: Date,
  from: Date,
  to: Date,
): Date[] {
  try {
    const rule = rrulestr(rruleStr, { dtstart: anchorMidnightUTC(dtstart) });
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
