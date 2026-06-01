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
import { z } from "zod";
import {
  CreateDishIngredientSchema,
  CreateDishSchema,
  MealTypeSchema,
  UpdateDishSchema,
  type CreateDish,
  type MealType,
  type UpdateDish,
} from "@mi-centro/shared";
import { CurrentUser, type AuthUser } from "../auth/auth.decorators";
import { ScopeHeader, ScopeResolver } from "../common/scope";
import { ZodValidationPipe } from "../common/zod.pipe";
import { DishesService } from "./dishes.service";

const CreateIngredientBodySchema = CreateDishIngredientSchema.omit({
  dish_id: true,
});
type CreateIngredientBody = z.infer<typeof CreateIngredientBodySchema>;

@Controller("dishes")
export class DishesController {
  constructor(
    private readonly svc: DishesService,
    private readonly scopeResolver: ScopeResolver,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @ScopeHeader() hdr: string) {
    const scope = await this.scopeResolver.resolve(user.id, hdr);
    return this.svc.list(user.id, scope);
  }

  @Get("suggestions")
  async suggestions(
    @CurrentUser() user: AuthUser,
    @ScopeHeader() hdr: string,
    @Query("meal_type") mealType?: string,
    @Query("date") date?: string,
  ) {
    let mt: MealType | undefined;
    if (mealType) {
      const parsed = MealTypeSchema.safeParse(mealType);
      if (!parsed.success) {
        throw new BadRequestException(`meal_type inválido: ${mealType}`);
      }
      mt = parsed.data;
    }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException(`date inválido: ${date}`);
    }
    const scope = await this.scopeResolver.resolve(user.id, hdr);
    return this.svc.suggestions(user.id, scope, mt, date);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @ScopeHeader() hdr: string,
    @Body(new ZodValidationPipe(CreateDishSchema)) body: CreateDish,
  ) {
    const scope = await this.scopeResolver.resolve(user.id, hdr);
    return this.svc.create(user.id, scope, body);
  }

  @Patch(":id")
  async update(
    @CurrentUser() user: AuthUser,
    @ScopeHeader() hdr: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateDishSchema)) body: UpdateDish,
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

  // ─── Ingredientes ──────────────────────────────────────────

  @Get(":id/ingredients")
  async listIngredients(
    @CurrentUser() user: AuthUser,
    @ScopeHeader() hdr: string,
    @Param("id", ParseUUIDPipe) dishId: string,
  ) {
    const scope = await this.scopeResolver.resolve(user.id, hdr);
    return this.svc.listIngredients(user.id, scope, dishId);
  }

  @Post(":id/ingredients")
  async addIngredient(
    @CurrentUser() user: AuthUser,
    @ScopeHeader() hdr: string,
    @Param("id", ParseUUIDPipe) dishId: string,
    @Body(new ZodValidationPipe(CreateIngredientBodySchema))
    body: CreateIngredientBody,
  ) {
    const scope = await this.scopeResolver.resolve(user.id, hdr);
    return this.svc.addIngredient(user.id, scope, dishId, body);
  }

  @Delete(":id/ingredients/:ingredientId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeIngredient(
    @CurrentUser() user: AuthUser,
    @ScopeHeader() hdr: string,
    @Param("id", ParseUUIDPipe) dishId: string,
    @Param("ingredientId", ParseUUIDPipe) ingredientId: string,
  ) {
    const scope = await this.scopeResolver.resolve(user.id, hdr);
    await this.svc.removeIngredient(user.id, scope, dishId, ingredientId);
  }
}
