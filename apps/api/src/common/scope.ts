import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DB, type Db } from "../db/db.module";
import { coupleMembers } from "../db/schema";

/**
 * Scope activo de una request. Se infiere del header X-Scope:
 *   - "personal" (default) → entidades con couple_id IS NULL del usuario
 *   - "couple"             → entidades con couple_id = la pareja del usuario
 *
 * Si el cliente pide "couple" y el usuario no tiene pareja, devolvemos 403.
 */
export interface RequestScope {
  /** "personal" | "couple" */
  kind: "personal" | "couple";
  /** Si kind === "couple", el id de la pareja activa. */
  coupleId: string | null;
}

/**
 * Decorador para extraer el header X-Scope crudo del request.
 * El servicio que lo usa debe llamar a ScopeResolver.resolve() para validar.
 */
export const ScopeHeader = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const raw = req.headers["x-scope"];
    if (Array.isArray(raw)) return raw[0] ?? "personal";
    return (raw ?? "personal").toString().trim().toLowerCase();
  },
);

@Injectable()
export class ScopeResolver {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Convierte el header crudo en un RequestScope válido. Valida que el
   * usuario pertenezca a una pareja si pide scope=couple.
   */
  async resolve(userId: string, headerValue: string): Promise<RequestScope> {
    const value = headerValue.trim().toLowerCase();

    if (value === "" || value === "personal") {
      return { kind: "personal", coupleId: null };
    }

    if (value !== "couple") {
      throw new BadRequestException(
        `X-Scope inválido: "${headerValue}". Esperado "personal" o "couple".`,
      );
    }

    const [member] = await this.db
      .select({ coupleId: coupleMembers.coupleId })
      .from(coupleMembers)
      .where(eq(coupleMembers.userId, userId))
      .limit(1);

    if (!member) {
      throw new ForbiddenException(
        "No perteneces a ninguna pareja. Vincula una desde tu perfil.",
      );
    }

    return { kind: "couple", coupleId: member.coupleId };
  }
}
