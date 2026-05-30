import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UsePipes,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import {
  LoginRequestSchema,
  RegisterRequestSchema,
  type LoginRequest,
  type RegisterRequest,
} from "@mi-centro/shared";
import { ZodValidationPipe } from "../common/zod.pipe";
import { Public } from "./auth.decorators";
import { AuthService } from "./auth.service";

const REFRESH_COOKIE = "mc_refresh";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post("register")
  @UsePipes(new ZodValidationPipe(RegisterRequestSchema))
  async register(
    @Body() body: RegisterRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.register(body);
    this.setRefreshCookie(res, result.tokens.refresh_token, result.tokens.refresh_expires_in);
    return {
      user: result.user,
      tokens: {
        access_token: result.tokens.access_token,
        access_expires_in: result.tokens.access_expires_in,
      },
    };
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(LoginRequestSchema))
  async login(
    @Body() body: LoginRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(body);
    this.setRefreshCookie(res, result.tokens.refresh_token, result.tokens.refresh_expires_in);
    return {
      user: result.user,
      tokens: {
        access_token: result.tokens.access_token,
        access_expires_in: result.tokens.access_expires_in,
      },
    };
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    const token = cookies?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException("Falta refresh token");

    const tokens = await this.auth.refresh(token);
    this.setRefreshCookie(res, tokens.refresh_token, tokens.refresh_expires_in);
    return {
      access_token: tokens.access_token,
      access_expires_in: tokens.access_expires_in,
    };
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(REFRESH_COOKIE, this.cookieOpts(0));
  }

  private setRefreshCookie(res: Response, token: string, ttlSeconds: number) {
    res.cookie(REFRESH_COOKIE, token, this.cookieOpts(ttlSeconds));
  }

  private cookieOpts(ttlSeconds: number) {
    const isProd = this.config.get<string>("NODE_ENV") === "production";
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax" as const,
      path: "/api/auth",
      maxAge: ttlSeconds * 1000,
      domain: this.config.get<string>("COOKIE_DOMAIN") ?? undefined,
    };
  }
}
