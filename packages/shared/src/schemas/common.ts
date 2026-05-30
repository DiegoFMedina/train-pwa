import { z } from "zod";

export const UuidSchema = z.string().uuid();

export const IsoDateTimeSchema = z.string().datetime({ offset: true });

export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha en formato YYYY-MM-DD");

export const TimeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora en formato HH:mm");

export const CurrencySchema = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/, "Código ISO-4217 de 3 letras")
  .default("CLP");

export const MoneyAmountSchema = z
  .number()
  .finite()
  .nonnegative()
  .multipleOf(0.01, "Máximo 2 decimales");

export const NotifyModeSchema = z.enum(["notify", "vibrate", "silent"]);
export type NotifyMode = z.infer<typeof NotifyModeSchema>;

export const TransactionKindSchema = z.enum(["income", "expense"]);
export type TransactionKind = z.infer<typeof TransactionKindSchema>;

export const SyncFieldsSchema = z.object({
  id: UuidSchema,
  created_at: IsoDateTimeSchema,
  updated_at: IsoDateTimeSchema,
  deleted_at: IsoDateTimeSchema.nullable(),
  version: z.number().int().positive(),
});
export type SyncFields = z.infer<typeof SyncFieldsSchema>;

export const HexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Color en formato #RRGGBB");
