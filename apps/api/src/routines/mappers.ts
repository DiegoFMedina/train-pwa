import type { Routine as SharedRoutine, RoutineLog as SharedLog } from "@mi-centro/shared";
import type { routineLogs, routines } from "../db/schema";

const iso = (d: Date): string => d.toISOString();
const isoOrNull = (d: Date | null): string | null => (d ? iso(d) : null);
const dateOnly = (d: Date | string): string =>
  typeof d === "string" ? d : d.toISOString().slice(0, 10);
const timeOnly = (s: string | null): string => {
  if (!s) return "00:00";
  // Postgres TIME viene como "HH:MM:SS"; quedamos con HH:MM.
  return s.slice(0, 5);
};

export function toRoutine(r: typeof routines.$inferSelect): SharedRoutine {
  return {
    id: r.id,
    user_id: r.userId,
    couple_id: r.coupleId ?? null,
    title: r.title,
    notes: r.notes,
    rrule: r.rrule,
    time_of_day: timeOnly(r.timeOfDay),
    duration_minutes: r.durationMinutes ?? 30,
    notify_mode: r.notifyMode as SharedRoutine["notify_mode"],
    active: r.active,
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
    deleted_at: isoOrNull(r.deletedAt),
    version: r.version,
  };
}

export function toRoutineLog(r: typeof routineLogs.$inferSelect): SharedLog {
  return {
    id: r.id,
    user_id: r.userId,
    routine_id: r.routineId,
    due_on: dateOnly(r.dueOn),
    status: r.status as SharedLog["status"],
    completed_at: isoOrNull(r.completedAt),
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
    deleted_at: isoOrNull(r.deletedAt),
    version: r.version,
  };
}
