import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq, gt, isNull, lte } from "drizzle-orm";
import type {
  Couple,
  CoupleInvitation,
  CoupleMember,
  CoupleMode,
  CoupleWithMembers,
  UpdateCouple,
} from "@mi-centro/shared";
import { DB, type Db } from "../db/db.module";
import { coupleInvitations, coupleMembers, couples, users } from "../db/schema";
import { toCouple, toInvitation, toMember } from "./mappers";

const MAX_MEMBERS = 2;

@Injectable()
export class CouplesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** La pareja actual del user (o null si no pertenece a ninguna). */
  async myCouple(userId: string): Promise<CoupleWithMembers | null> {
    const [member] = await this.db
      .select()
      .from(coupleMembers)
      .where(eq(coupleMembers.userId, userId))
      .limit(1);
    if (!member) return null;
    return this.findByIdWithMembers(member.coupleId);
  }

  async create(
    userId: string,
    name: string,
    mode: CoupleMode = "separate",
  ): Promise<CoupleWithMembers> {
    // Un user solo puede pertenecer a una pareja a la vez.
    const existing = await this.myCouple(userId);
    if (existing) {
      throw new ConflictException("Ya perteneces a una pareja");
    }

    const couple = await this.db.transaction(async (tx) => {
      const [c] = await tx
        .insert(couples)
        .values({ name, mode, ownerId: userId })
        .returning();
      if (!c) throw new Error("INSERT couples no devolvió fila");

      await tx.insert(coupleMembers).values({
        coupleId: c.id,
        userId,
        role: "owner",
        invitedBy: null,
      });

      return c;
    });

    const full = await this.findByIdWithMembers(couple.id);
    if (!full) throw new Error("couple recién creada no se encontró");
    return full;
  }

  /**
   * Actualiza name o mode (o ambos). Solo el owner puede cambiar.
   * El cambio de mode NO destruye datos — solo afecta la UX cliente.
   */
  async update(
    userId: string,
    coupleId: string,
    patch: UpdateCouple,
  ): Promise<Couple> {
    await this.assertOwner(userId, coupleId);
    const updates: Partial<typeof couples.$inferInsert> = {};
    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.mode !== undefined) updates.mode = patch.mode;
    if (Object.keys(updates).length === 0) {
      // No hay cambios; devolver la couple tal cual
      const [row] = await this.db
        .select()
        .from(couples)
        .where(and(eq(couples.id, coupleId), isNull(couples.deletedAt)))
        .limit(1);
      if (!row) throw new NotFoundException("Pareja no encontrada");
      return toCouple(row);
    }
    updates.updatedAt = new Date();
    const [row] = await this.db
      .update(couples)
      .set(updates)
      .where(and(eq(couples.id, coupleId), isNull(couples.deletedAt)))
      .returning();
    if (!row) throw new NotFoundException("Pareja no encontrada");
    return toCouple(row);
  }

  /** Solo el owner puede borrar la pareja. Soft delete + cascade en members. */
  async deleteOwnedCouple(userId: string, coupleId: string): Promise<void> {
    await this.assertOwner(userId, coupleId);
    await this.db
      .update(couples)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(couples.id, coupleId));
    // borrar members es cascade automático cuando borramos la couple,
    // pero como hacemos soft delete tenemos que limpiar a mano:
    await this.db.delete(coupleMembers).where(eq(coupleMembers.coupleId, coupleId));
    // Revocar invitaciones pendientes
    await this.db
      .update(coupleInvitations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(coupleInvitations.coupleId, coupleId),
          isNull(coupleInvitations.acceptedAt),
          isNull(coupleInvitations.revokedAt),
        ),
      );
  }

  /** Cualquier member (no solo owner) puede irse — el owner debe borrar. */
  async leave(userId: string, coupleId: string): Promise<void> {
    await this.assertMember(userId, coupleId);
    const [m] = await this.db
      .select()
      .from(coupleMembers)
      .where(
        and(
          eq(coupleMembers.coupleId, coupleId),
          eq(coupleMembers.userId, userId),
        ),
      )
      .limit(1);
    if (m?.role === "owner") {
      throw new BadRequestException(
        "El owner no puede dejar la pareja — debe borrarla o transferir ownership",
      );
    }
    await this.db
      .delete(coupleMembers)
      .where(
        and(
          eq(coupleMembers.coupleId, coupleId),
          eq(coupleMembers.userId, userId),
        ),
      );
  }

  /** Owner expulsa a un miembro. */
  async kick(
    ownerId: string,
    coupleId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.assertOwner(ownerId, coupleId);
    if (ownerId === targetUserId) {
      throw new BadRequestException("El owner no puede expulsarse a sí mismo");
    }
    const result = await this.db
      .delete(coupleMembers)
      .where(
        and(
          eq(coupleMembers.coupleId, coupleId),
          eq(coupleMembers.userId, targetUserId),
        ),
      )
      .returning({ userId: coupleMembers.userId });
    if (result.length === 0) {
      throw new NotFoundException("Miembro no encontrado");
    }
  }

  // ─── Invitaciones ──────────────────────────────────────────

  /** Genera un código de invitación legible. */
  async createInvitation(
    userId: string,
    coupleId: string,
    ttlHours: number,
  ): Promise<CoupleInvitation> {
    await this.assertMember(userId, coupleId);

    // Pareja llena: no permitir invitar más.
    const members = await this.db
      .select({ userId: coupleMembers.userId })
      .from(coupleMembers)
      .where(eq(coupleMembers.coupleId, coupleId));
    if (members.length >= MAX_MEMBERS) {
      throw new BadRequestException(
        "La pareja ya está completa (máx 2 personas)",
      );
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    const [row] = await this.db
      .insert(coupleInvitations)
      .values({
        coupleId,
        code,
        invitedBy: userId,
        expiresAt,
      })
      .returning();
    if (!row) throw new Error("INSERT couple_invitations no devolvió fila");
    return toInvitation(row);
  }

  async listInvitations(
    userId: string,
    coupleId: string,
  ): Promise<CoupleInvitation[]> {
    await this.assertMember(userId, coupleId);
    const rows = await this.db
      .select()
      .from(coupleInvitations)
      .where(
        and(
          eq(coupleInvitations.coupleId, coupleId),
          isNull(coupleInvitations.acceptedAt),
          isNull(coupleInvitations.revokedAt),
          gt(coupleInvitations.expiresAt, new Date()),
        ),
      );
    return rows.map(toInvitation);
  }

  async revokeInvitation(
    userId: string,
    invitationId: string,
  ): Promise<void> {
    const [inv] = await this.db
      .select()
      .from(coupleInvitations)
      .where(eq(coupleInvitations.id, invitationId))
      .limit(1);
    if (!inv) throw new NotFoundException("Invitación no encontrada");
    await this.assertMember(userId, inv.coupleId);
    if (inv.revokedAt || inv.acceptedAt) return; // idempotente
    await this.db
      .update(coupleInvitations)
      .set({ revokedAt: new Date() })
      .where(eq(coupleInvitations.id, invitationId));
  }

  async accept(userId: string, code: string): Promise<CoupleWithMembers> {
    const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (normalized.length < 4) {
      throw new BadRequestException("Código inválido");
    }

    const [inv] = await this.db
      .select()
      .from(coupleInvitations)
      .where(eq(coupleInvitations.code, normalized))
      .limit(1);
    if (!inv) throw new NotFoundException("Código no válido o expirado");
    if (inv.revokedAt) throw new BadRequestException("Esta invitación fue revocada");
    if (inv.acceptedAt) throw new BadRequestException("Esta invitación ya se usó");
    if (inv.expiresAt < new Date()) {
      throw new BadRequestException("Esta invitación expiró");
    }

    // ¿El user ya pertenece a una pareja?
    const existing = await this.myCouple(userId);
    if (existing) {
      throw new ConflictException(
        "Ya perteneces a una pareja. Debes dejarla primero.",
      );
    }

    // ¿Está llena la pareja?
    const members = await this.db
      .select({ userId: coupleMembers.userId })
      .from(coupleMembers)
      .where(eq(coupleMembers.coupleId, inv.coupleId));
    if (members.length >= MAX_MEMBERS) {
      throw new BadRequestException("La pareja ya está completa");
    }

    await this.db.transaction(async (tx) => {
      await tx.insert(coupleMembers).values({
        coupleId: inv.coupleId,
        userId,
        role: "member",
        invitedBy: inv.invitedBy,
      });
      await tx
        .update(coupleInvitations)
        .set({ acceptedAt: new Date(), acceptedBy: userId })
        .where(eq(coupleInvitations.id, inv.id));
    });

    const full = await this.findByIdWithMembers(inv.coupleId);
    if (!full) throw new Error("couple no se encontró post-accept");
    return full;
  }

  // ─── Internals ─────────────────────────────────────────────

  /** Devuelve la pareja con sus miembros (incluye nombre + email). */
  private async findByIdWithMembers(
    coupleId: string,
  ): Promise<CoupleWithMembers | null> {
    const [c] = await this.db
      .select()
      .from(couples)
      .where(and(eq(couples.id, coupleId), isNull(couples.deletedAt)))
      .limit(1);
    if (!c) return null;

    const members = await this.db
      .select({
        m: coupleMembers,
        u: { name: users.name, email: users.email },
      })
      .from(coupleMembers)
      .innerJoin(users, eq(users.id, coupleMembers.userId))
      .where(eq(coupleMembers.coupleId, coupleId));

    return {
      ...toCouple(c),
      members: members.map((row) => toMember(row.m, row.u)),
    };
  }

  private async assertMember(userId: string, coupleId: string): Promise<void> {
    const [m] = await this.db
      .select({ userId: coupleMembers.userId })
      .from(coupleMembers)
      .where(
        and(
          eq(coupleMembers.coupleId, coupleId),
          eq(coupleMembers.userId, userId),
        ),
      )
      .limit(1);
    if (!m) throw new ForbiddenException("No perteneces a esta pareja");
  }

  private async assertOwner(userId: string, coupleId: string): Promise<void> {
    const [m] = await this.db
      .select({ role: coupleMembers.role })
      .from(coupleMembers)
      .where(
        and(
          eq(coupleMembers.coupleId, coupleId),
          eq(coupleMembers.userId, userId),
        ),
      )
      .limit(1);
    if (!m) throw new ForbiddenException("No perteneces a esta pareja");
    if (m.role !== "owner") {
      throw new ForbiddenException("Solo el owner puede hacer esta acción");
    }
  }
}

/**
 * Código corto legible: 8 chars sin caracteres ambiguos (0/O/1/I/L).
 * Formato: XXXX-XXXX para fácil dictado.
 */
function generateCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    if (i === 4) out += "-";
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
