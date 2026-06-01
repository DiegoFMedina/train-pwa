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
  CreateMealPlanSchema,
  UpdateMealPlanSchema,
  type CreateMealPlan,
  type UpdateMealPlan,
} from "@mi-centro/shared";
import { CurrentUser, type AuthUser } from "../auth/auth.decorators";
import { ScopeHeader, ScopeResolver } from "../common/scope";
import { ZodValidationPipe } from "../common/zod.pipe";
import { MealPlansService } from "./meal-plans.service";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

@Controller("meal-plans")
export class MealPlansController {
  constructor(
    private readonly svc: MealPlansService,
    private readonly scopeResolver: ScopeResolver,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @ScopeHeader() hdr: string,
    @Query("date") date?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const scope = await this.scopeResolver.resolve(user.id, hdr);
    if (from || to) {
      const f = from ?? new Date().toISOString().slice(0, 10);
      const t = to ?? f;
      if (!YMD_RE.test(f) || !YMD_RE.test(t)) {
        throw new BadRequestException("from/to en formato YYYY-MM-DD");
      }
      return this.svc.listInRange(user.id, scope, f, t);
    }
    const d = date ?? new Date().toISOString().slice(0, 10);
    if (!YMD_RE.test(d)) {
      throw new BadRequestException(`date inválido: ${d} (esperado YYYY-MM-DD)`);
    }
    return this.svc.listForDay(user.id, scope, d);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @ScopeHeader() hdr: string,
    @Body(new ZodValidationPipe(CreateMealPlanSchema)) body: CreateMealPlan,
  ) {
    const scope = await this.scopeResolver.resolve(user.id, hdr);
    return this.svc.create(user.id, scope, body);
  }

  @Patch(":id")
  async update(
    @CurrentUser() user: AuthUser,
    @ScopeHeader() hdr: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateMealPlanSchema)) body: UpdateMealPlan,
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

  @Get("shopping-list")
  async shoppingList(
    @CurrentUser() user: AuthUser,
    @ScopeHeader() hdr: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const today = new Date().toISOString().slice(0, 10);
    const next7 = new Date();
    next7.setUTCDate(next7.getUTCDate() + 6);
    const f = from ?? today;
    const t = to ?? next7.toISOString().slice(0, 10);
    if (!YMD_RE.test(f) || !YMD_RE.test(t)) {
      throw new BadRequestException("from/to en formato YYYY-MM-DD");
    }
    const scope = await this.scopeResolver.resolve(user.id, hdr);
    return this.svc.shoppingList(user.id, scope, f, t);
  }
}
