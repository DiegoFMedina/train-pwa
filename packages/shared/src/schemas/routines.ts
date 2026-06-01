import { z } from "zod";
import {
  IsoDateSchema,
  IsoDateTimeSchema,
  NotifyModeSchema,
  SyncFieldsSchema,
  TimeOfDaySchema,
  UuidSchema,
} from "./common.js";

export const RoutineBaseSchema = z.object({
  title: z.string().min(1).max(120),
  notes: z.string().max(2000).nullable().optional(),
  rrule: z.string().min(1, "RRULE RFC 5545 requerida"),
  time_of_day: TimeOfDaySchema,
  duration_minutes: z.number().int().positive().max(1440).default(30),
  notify_mode: NotifyModeSchema.default("notify"),
  active: z.boolean().default(true),
});

export const RoutineSchema = RoutineBaseSchema.merge(SyncFieldsSchema).extend({
  user_id: UuidSchema,
  couple_id: UuidSchema.nullable(),
});
export type Routine = z.infer<typeof RoutineSchema>;

export const CreateRoutineSchema = RoutineBaseSchema.extend({
  id: UuidSchema.optional(),
});
export type CreateRoutine = z.infer<typeof CreateRoutineSchema>;

export const UpdateRoutineSchema = RoutineBaseSchema.partial();
export type UpdateRoutine = z.infer<typeof UpdateRoutineSchema>;

// ─── Routine logs (cumplimiento por día) ──────────────────────

export const RoutineLogStatusSchema = z.enum([
  "pending",
  "done",
  "skipped",
  "missed",
]);
export type RoutineLogStatus = z.infer<typeof RoutineLogStatusSchema>;

export const RoutineLogBaseSchema = z.object({
  routine_id: UuidSchema,
  due_on: IsoDateSchema,
  status: RoutineLogStatusSchema.default("pending"),
  completed_at: IsoDateTimeSchema.nullable().optional(),
});

export const RoutineLogSchema = RoutineLogBaseSchema
  .merge(SyncFieldsSchema)
  .extend({ user_id: UuidSchema });
export type RoutineLog = z.infer<typeof RoutineLogSchema>;

// Marcar cumplimiento (upsert por routine_id + due_on)
export const MarkRoutineLogSchema = z.object({
  routine_id: UuidSchema,
  due_on: IsoDateSchema,
  status: RoutineLogStatusSchema,
});
export type MarkRoutineLog = z.infer<typeof MarkRoutineLogSchema>;

// Estadísticas de cumplimiento
export const RoutineStatsSchema = z.object({
  routine_id: UuidSchema,
  range_from: IsoDateSchema,
  range_to: IsoDateSchema,
  expected: z.number().int().nonnegative(),
  done: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  missed: z.number().int().nonnegative(),
  completion_rate: z.number().min(0).max(1),
  current_streak: z.number().int().nonnegative(),
});
export type RoutineStats = z.infer<typeof RoutineStatsSchema>;
