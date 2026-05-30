import { z } from "zod";
import {
  IsoDateTimeSchema,
  NotifyModeSchema,
  UuidSchema,
} from "./common.js";

export const ReminderSourceTypeSchema = z.enum([
  "routine",
  "meal",
  "goal",
  "transaction",
]);
export type ReminderSourceType = z.infer<typeof ReminderSourceTypeSchema>;

export const ReminderStatusSchema = z.enum(["pending", "sent", "cancelled"]);
export type ReminderStatus = z.infer<typeof ReminderStatusSchema>;

export const ReminderSchema = z.object({
  id: UuidSchema,
  user_id: UuidSchema,
  source_type: ReminderSourceTypeSchema,
  source_id: UuidSchema,
  title: z.string().min(1).max(160),
  body: z.string().max(2000).nullable(),
  fire_at: IsoDateTimeSchema,
  notify_mode: NotifyModeSchema,
  status: ReminderStatusSchema,
  sent_at: IsoDateTimeSchema.nullable(),
  created_at: IsoDateTimeSchema,
});
export type Reminder = z.infer<typeof ReminderSchema>;

// ─── Push subscriptions ───────────────────────────────────────

export const PushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  device_label: z.string().max(80).nullable().optional(),
});
export type PushSubscriptionPayload = z.infer<typeof PushSubscriptionSchema>;
