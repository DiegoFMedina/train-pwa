import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  CreateRoutineSchema,
  MarkRoutineLogSchema,
  UpdateRoutineSchema,
  type CreateRoutine,
  type MarkRoutineLog,
  type UpdateRoutine,
} from "@mi-centro/shared";
import { CurrentUser, type AuthUser } from "../auth/auth.decorators";
import { ScopeHeader, ScopeResolver } from "../common/scope";
import { ZodValidationPipe } from "../common/zod.pipe";
import { RoutinesService } from "./routines.service";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

@Controller("routines")
export class RoutinesController {
  constructor(
    private readonly svc: RoutinesService,
    private readonly scopeResolver: ScopeResolver,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @ScopeHeader() hdr: string) {
    const scope = await this.scopeResolver.resolve(user.id, hdr);
    return this.svc.list(user.id, scope);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @ScopeHeader() hdr: string,
    @Body(new ZodValidationPipe(CreateRoutineSchema)) body: CreateRoutine,
  ) {
    const scope = await this.scopeResolver.resolve(user.id, hdr);
    return this.svc.create(user.id, scope, body);
  }

  @Patch(":id")
  async update(
    @CurrentUser() user: AuthUser,
    @ScopeHeader() hdr: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateRoutineSchema)) body: UpdateRoutine,
  ) {
    const scope = await this.scopeResolver.resolve(user.id, hdr);
    return this.svc.update(user.id, scope, id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @ScopeHeader() hdr: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const scope = await this.scopeResolver.resolve(user.id, hdr);
    await this.svc.softDelete(user.id, scope, id);
  }

  @Get("instances")
  async instances(
    @CurrentUser() user: AuthUser,
    @ScopeHeader() hdr: string,
    @Query("date") date?: string,
  ) {
    const d = date ?? new Date().toISOString().slice(0, 10);
    if (!YMD_RE.test(d)) {
      throw new BadRequestException(`date inválido: ${d} (esperado YYYY-MM-DD)`);
    }
    const scope = await this.scopeResolver.resolve(user.id, hdr);
    return this.svc.instancesForDate(user.id, scope, d);
  }

  @Post("logs")
  async markLog(
    @CurrentUser() user: AuthUser,
    @ScopeHeader() hdr: string,
    @Body(new ZodValidationPipe(MarkRoutineLogSchema)) body: MarkRoutineLog,
  ) {
    const scope = await this.scopeResolver.resolve(user.id, hdr);
    return this.svc.markLog(user.id, scope, body);
  }

  @Get(":id/stats")
  async stats(
    @CurrentUser() user: AuthUser,
    @ScopeHeader() hdr: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const today = new Date().toISOString().slice(0, 10);
    const ago = new Date();
    ago.setUTCDate(ago.getUTCDate() - 29);
    const f = from ?? ago.toISOString().slice(0, 10);
    const t = to ?? today;
    if (!YMD_RE.test(f) || !YMD_RE.test(t)) {
      throw new BadRequestException("from/to en formato YYYY-MM-DD");
    }
    const scope = await this.scopeResolver.resolve(user.id, hdr);
    return this.svc.stats(user.id, scope, id, f, t);
  }
}
