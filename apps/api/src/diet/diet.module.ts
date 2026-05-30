import { Module } from "@nestjs/common";
import { DishesController } from "./dishes.controller";
import { DishesService } from "./dishes.service";
import { MealPlansController } from "./meal-plans.controller";
import { MealPlansService } from "./meal-plans.service";

@Module({
  controllers: [DishesController, MealPlansController],
  providers: [DishesService, MealPlansService],
})
export class DietModule {}
