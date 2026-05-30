import {
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
} from "@nestjs/common";
import { z } from "zod";
import {
  CreateDishIngredientSchema,
  CreateDishSchema,
  UpdateDishSchema,
  type CreateDish,
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
