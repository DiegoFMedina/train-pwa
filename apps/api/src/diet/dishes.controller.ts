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
import { ZodValidationPipe } from "../common/zod.pipe";
import { DishesService } from "./dishes.service";

const CreateIngredientBodySchema = CreateDishIngredientSchema.omit({
  dish_id: true,
});
type CreateIngredientBody = z.infer<typeof CreateIngredientBodySchema>;

@Controller("dishes")
export class DishesController {
  constructor(private readonly svc: DishesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.svc.list(user.id);
  }

  /**
   * Sugerencias para planificar: prioriza platos no usados hace tiempo.
   * Opcional ?meal_type para sesgar por tipo de comida.
   */
  @Get("suggestions")
  suggestions(@CurrentUser() user: AuthUser, @Query("meal_type") mealType?: string) {
    let mt: MealType | undefined;
    if (mealType) {
      const parsed = MealTypeSchema.safeParse(mealType);
      if (!parsed.success) {
        throw new BadRequestException(`meal_type inválido: ${mealType}`);
      }
      mt = parsed.data;
    }
    return this.svc.suggestions(user.id, mt);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateDishSchema)) body: CreateDish,
  ) {
    return this.svc.create(user.id, body);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateDishSchema)) body: UpdateDish,
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

  // ─── ingredientes ──────────────────────────────────────────

  @Get(":id/ingredients")
  listIngredients(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) dishId: string,
  ) {
    return this.svc.listIngredients(user.id, dishId);
  }

  @Post(":id/ingredients")
  addIngredient(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) dishId: string,
    @Body(new ZodValidationPipe(CreateIngredientBodySchema))
    body: CreateIngredientBody,
  ) {
    return this.svc.addIngredient(user.id, dishId, body);
  }

  @Delete(":id/ingredients/:ingredientId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeIngredient(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) dishId: string,
    @Param("ingredientId", ParseUUIDPipe) ingredientId: string,
  ) {
    await this.svc.removeIngredient(user.id, dishId, ingredientId);
  }
}
