import { Module } from "@nestjs/common";
import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";
import { ContributionsService } from "./contributions.service";
import { GoalsController } from "./goals.controller";
import { GoalsService } from "./goals.service";
import { RecurringController } from "./recurring.controller";
import { RecurringService } from "./recurring.service";
import { SummaryController } from "./summary.controller";
import { SummaryService } from "./summary.service";
import { TransactionsController } from "./transactions.controller";
import { TransactionsService } from "./transactions.service";

@Module({
  controllers: [
    CategoriesController,
    TransactionsController,
    RecurringController,
    GoalsController,
    SummaryController,
  ],
  providers: [
    CategoriesService,
    TransactionsService,
    RecurringService,
    GoalsService,
    ContributionsService,
    SummaryService,
  ],
})
export class FinanceModule {}
