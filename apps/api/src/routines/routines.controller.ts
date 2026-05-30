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
import { ZodValidationPipe } from "../common/zod.pipe";
import { RoutinesService } from "./routines.service";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

@Controller("routines")
export class RoutinesController {
  constructor(private readonly svc: RoutinesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.svc.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateRoutineSchema)) body: CreateRoutine,
  ) {
    return this.svc.create(user.id, body);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateRoutineSchema)) body: UpdateRoutine,
  ) {
    return this.svc.update(user.id, id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    await this.svc.softDelete(user.id, id);
  }

  /** Instancias del día: rutinas que caen ese día + su log si existe. */
  @Get("instances")
  instances(@CurrentUser() user: AuthUser, @Query("date") date?: string) {
    const d = date ?? new Date().toISOString().slice(0, 10);
    if (!YMD_RE.test(d)) {
      throw new BadRequestException(`date inválido: ${d} (esperado YYYY-MM-DD)`);
    }
    return this.svc.instancesForDate(user.id, d);
  }

  /** Marcar cumplimiento (upsert por routine_id + due_on). */
  @Post("logs")
  markLog(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(MarkRoutineLogSchema)) body: MarkRoutineLog,
  ) {
    return this.svc.markLog(user.id, body);
  }

  /** Stats en rango. Default: últimos 30 días incluyendo hoy. */
  @Get(":id/stats")
  stats(
    @CurrentUser() user: AuthUser,
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
    return this.svc.stats(user.id, id, f, t);
  }
}
