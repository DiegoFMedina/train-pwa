import { z } from "zod";
import { IsoDateTimeSchema, UuidSchema } from "./common.js";

export const CoupleRoleSchema = z.enum(["owner", "member"]);
export type CoupleRole = z.infer<typeof CoupleRoleSchema>;

export const CoupleSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).max(80),
  owner_id: UuidSchema,
  created_at: IsoDateTimeSchema,
  updated_at: IsoDateTimeSchema,
});
export type Couple = z.infer<typeof CoupleSchema>;

export const CoupleMemberSchema = z.object({
  couple_id: UuidSchema,
  user_id: UuidSchema,
  role: CoupleRoleSchema,
  joined_at: IsoDateTimeSchema,
  invited_by: UuidSchema.nullable(),
  // Datos del user denormalizados para listar miembros sin un join extra
  user_name: z.string(),
  user_email: z.string().email(),
});
export type CoupleMember = z.infer<typeof CoupleMemberSchema>;

export const CoupleWithMembersSchema = CoupleSchema.extend({
  members: z.array(CoupleMemberSchema),
});
export type CoupleWithMembers = z.infer<typeof CoupleWithMembersSchema>;

export const CreateCoupleSchema = z.object({
  name: z.string().min(1).max(80).default("Nuestra cuenta"),
});
export type CreateCouple = z.infer<typeof CreateCoupleSchema>;

export const UpdateCoupleSchema = z.object({
  name: z.string().min(1).max(80),
});
export type UpdateCouple = z.infer<typeof UpdateCoupleSchema>;

// ─── Invitaciones ─────────────────────────────────────────────

export const CoupleInvitationSchema = z.object({
  id: UuidSchema,
  couple_id: UuidSchema,
  code: z.string().min(4).max(16),
  invited_by: UuidSchema,
  expires_at: IsoDateTimeSchema,
  accepted_at: IsoDateTimeSchema.nullable(),
  revoked_at: IsoDateTimeSchema.nullable(),
  created_at: IsoDateTimeSchema,
});
export type CoupleInvitation = z.infer<typeof CoupleInvitationSchema>;

export const CreateInvitationSchema = z.object({
  ttl_hours: z.number().int().positive().max(168).default(24),
});
export type CreateInvitation = z.infer<typeof CreateInvitationSchema>;

export const AcceptInvitationSchema = z.object({
  code: z.string().min(4).max(16),
});
export type AcceptInvitation = z.infer<typeof AcceptInvitationSchema>;

// Scope que el cliente manda en cada request via header X-Scope:
//   "personal"      → solo entidades del user (couple_id IS NULL)
//   "couple"        → solo entidades de su pareja activa (couple_id = active)
// El header es opcional; default = "personal".
export const ScopeSchema = z.enum(["personal", "couple"]);
export type Scope = z.infer<typeof ScopeSchema>;
