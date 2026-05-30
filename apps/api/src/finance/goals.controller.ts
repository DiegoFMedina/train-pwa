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
  CreateFinancialGoalSchema,
  CreateGoalContributionSchema,
  UpdateFinancialGoalSchema,
  type CreateFinancialGoal,
  type UpdateFinancialGoal,
} from "@mi-centro/shared";
import { CurrentUser, type AuthUser } from "../auth/auth.decorators";
import { ZodValidationPipe } from "../common/zod.pipe";
import { ContributionsService } from "./contributions.service";
import { GoalsService } from "./goals.service";

// El body de POST /goals/:id/contributions no requiere goal_id (viene del path).
const CreateContributionBodySchema = CreateGoalContributionSchema.omit({
  goal_id: true,
});
type CreateContributionBody = z.infer<typeof CreateContributionBodySchema>;

@Controller("goals")
export class GoalsController {
  constructor(
    private readonly svc: GoalsService,
    private readonly contributions: ContributionsService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.svc.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateFinancialGoalSchema)) body: CreateFinancialGoal,
  ) {
    return this.svc.create(user.id, body);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateFinancialGoalSchema)) body: UpdateFinancialGoal,
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

  // ─── sub-recurso contributions ─────────────────────────────

  @Get(":id/contributions")
  listContributions(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) goalId: string,
  ) {
    return this.contributions.listForGoal(user.id, goalId);
  }

  @Post(":id/contributions")
  addContribution(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) goalId: string,
    @Body(new ZodValidationPipe(CreateContributionBodySchema))
    body: CreateContributionBody,
  ) {
    return this.contributions.create(user.id, goalId, body);
  }

  @Delete(":id/contributions/:contributionId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeContribution(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) goalId: string,
    @Param("contributionId", ParseUUIDPipe) contributionId: string,
  ) {
    await this.contributions.softDelete(user.id, goalId, contributionId);
  }
}
