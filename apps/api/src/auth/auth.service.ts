import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { hash, verify } from "@node-rs/argon2";
import { eq } from "drizzle-orm";
import type {
  LoginRequest,
  RegisterRequest,
  User as SharedUser,
} from "@mi-centro/shared";
import { DB, type Db } from "../db/db.module";
import { users } from "../db/schema";

// Parámetros recomendados por OWASP 2024 para argon2id.
const ARGON2_OPTS = {
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
} as const;

interface RefreshPayload {
  sub: string;
}

interface TokenPair {
  access_token: string;
  access_expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(input: RegisterRequest): Promise<{ user: SharedUser; tokens: TokenPair }> {
    const existing = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);
    if (existing.length > 0) {
      throw new ConflictException("Ya existe una cuenta con ese correo");
    }

    const passwordHash = await hash(input.password, ARGON2_OPTS);
    const [row] = await this.db
      .insert(users)
      .values({
        email: input.email,
        name: input.name,
        passwordHash,
      })
      .returning();
    if (!row) throw new Error("INSERT users no devolvió fila");

    const tokens = await this.issueTokens(row.id, row.email);
    return { user: this.toSharedUser(row), tokens };
  }

  async login(input: LoginRequest): Promise<{ user: SharedUser; tokens: TokenPair }> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);
    if (!row) throw new UnauthorizedException("Credenciales inválidas");

    const ok = await verify(row.passwordHash, input.password, ARGON2_OPTS);
    if (!ok) throw new UnauthorizedException("Credenciales inválidas");

    const tokens = await this.issueTokens(row.id, row.email);
    return { user: this.toSharedUser(row), tokens };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Refresh token inválido o expirado");
    }

    const [row] = await this.db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);
    if (!row) throw new UnauthorizedException("Usuario no existe");

    return this.issueTokens(row.id, row.email);
  }

  private async issueTokens(userId: string, email: string): Promise<TokenPair> {
    const accessSeconds = parseTtlSeconds(this.config.get<string>("JWT_ACCESS_TTL") ?? "15m");
    const refreshSeconds = parseTtlSeconds(this.config.get<string>("JWT_REFRESH_TTL") ?? "30d");

    const access_token = await this.jwt.signAsync(
      { sub: userId, email },
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: accessSeconds,
      },
    );
    const refresh_token = await this.jwt.signAsync(
      { sub: userId },
      {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
        expiresIn: refreshSeconds,
      },
    );

    return {
      access_token,
      access_expires_in: accessSeconds,
      refresh_token,
      refresh_expires_in: refreshSeconds,
    };
  }

  private toSharedUser(row: typeof users.$inferSelect): SharedUser {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      timezone: row.timezone,
      language: row.language as SharedUser["language"],
      theme: row.theme as SharedUser["theme"],
      default_currency: row.defaultCurrency,
      quiet_hours_start: row.quietHoursStart,
      quiet_hours_end: row.quietHoursEnd,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }
}

// Convierte "15m" / "30d" / "3600" en segundos. Soporta s/m/h/d.
function parseTtlSeconds(ttl: string): number {
  const m = /^(\d+)([smhd])?$/.exec(ttl.trim());
  if (!m) return 900;
  const n = Number(m[1]);
  switch (m[2]) {
    case "s":
    case undefined:
      return n;
    case "m":
      return n * 60;
    case "h":
      return n * 3600;
    case "d":
      return n * 86_400;
    default:
      return n;
  }
}
