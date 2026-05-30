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
import { ZodValidationPipe } from "../common/zod.pipe";
import { MealPlansService } from "./meal-plans.service";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

@Controller("meal-plans")
export class MealPlansController {
  constructor(private readonly svc: MealPlansService) {}

  /** Comidas de un día. Default: hoy. */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query("date") date?: string) {
    const d = date ?? new Date().toISOString().slice(0, 10);
    if (!YMD_RE.test(d)) {
      throw new BadRequestException(`date inválido: ${d} (esperado YYYY-MM-DD)`);
    }
    return this.svc.listForDay(user.id, d);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateMealPlanSchema)) body: CreateMealPlan,
  ) {
    return this.svc.create(user.id, body);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateMealPlanSchema)) body: UpdateMealPlan,
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

  /** Lista de compras agregada para un rango. */
  @Get("shopping-list")
  shoppingList(
    @CurrentUser() user: AuthUser,
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
    return this.svc.shoppingList(user.id, f, t);
  }
}
