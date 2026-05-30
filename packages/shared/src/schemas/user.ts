import { z } from "zod";
import {
  CurrencySchema,
  IsoDateTimeSchema,
  TimeOfDaySchema,
  UuidSchema,
} from "./common.js";

export const LanguageSchema = z.enum(["es", "en"]);
export type Language = z.infer<typeof LanguageSchema>;

export const ThemeSchema = z.enum(["light", "dark", "system"]);
export type Theme = z.infer<typeof ThemeSchema>;

export const UserPreferencesSchema = z.object({
  timezone: z.string().min(1).default("America/Santiago"),
  language: LanguageSchema.default("es"),
  theme: ThemeSchema.default("system"),
  default_currency: CurrencySchema,
  quiet_hours_start: TimeOfDaySchema.nullable().optional(),
  quiet_hours_end: TimeOfDaySchema.nullable().optional(),
});
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

export const UserSchema = z
  .object({
    id: UuidSchema,
    email: z.string().email(),
    name: z.string().min(1).max(120),
    created_at: IsoDateTimeSchema,
    updated_at: IsoDateTimeSchema,
  })
  .merge(UserPreferencesSchema);
export type User = z.infer<typeof UserSchema>;

export const UpdateUserPreferencesSchema = UserPreferencesSchema.partial();
export type UpdateUserPreferences = z.infer<typeof UpdateUserPreferencesSchema>;
