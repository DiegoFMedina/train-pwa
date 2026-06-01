import type {
  Couple as SharedCouple,
  CoupleInvitation as SharedInvitation,
  CoupleMember as SharedMember,
} from "@mi-centro/shared";
import type {
  coupleInvitations,
  coupleMembers,
  couples,
  users,
} from "../db/schema";

const iso = (d: Date): string => d.toISOString();
const isoOrNull = (d: Date | null): string | null => (d ? iso(d) : null);

export function toCouple(r: typeof couples.$inferSelect): SharedCouple {
  return {
    id: r.id,
    name: r.name,
    owner_id: r.ownerId,
    mode: r.mode as SharedCouple["mode"],
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
  };
}

export function toMember(
  m: typeof coupleMembers.$inferSelect,
  u: Pick<typeof users.$inferSelect, "name" | "email">,
): SharedMember {
  return {
    couple_id: m.coupleId,
    user_id: m.userId,
    role: m.role as SharedMember["role"],
    joined_at: iso(m.joinedAt),
    invited_by: m.invitedBy,
    user_name: u.name,
    user_email: u.email,
  };
}

export function toInvitation(
  r: typeof coupleInvitations.$inferSelect,
): SharedInvitation {
  return {
    id: r.id,
    couple_id: r.coupleId,
    code: r.code,
    invited_by: r.invitedBy,
    expires_at: iso(r.expiresAt),
    accepted_at: isoOrNull(r.acceptedAt),
    revoked_at: isoOrNull(r.revokedAt),
    created_at: iso(r.createdAt),
  };
}
