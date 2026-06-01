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
import { ScopeHeader, ScopeResolver } from "../common/scope";
import { ZodValidationPipe } from "../common/zod.pipe";
import { ContributionsService } from "./contributions.service";
import { GoalsService } from "./goals.service";

const CreateContributionBodySchema = CreateGoalContributionSchema.omit({
  goal_id: true,
});
type CreateContributionBody = z.infer<typeof CreateContributionBodySchema>;

@Controller("goals")
export class GoalsController {
  constructor(
    private readonly svc: GoalsService,
    private readonly contributions: ContributionsService,
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
    @Body(new ZodValidationPipe(CreateFinancialGoalSchema)) body: CreateFinancialGoal,
  ) {
    const scope = await this.scopeResolver.resolve(user.id, hdr);
    return this.svc.create(user.id, scope, body);
  }

  @Patch(":id")
  async update(
    @CurrentUser() user: AuthUser,
    @ScopeHeader() hdr: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateFinancialGoalSchema)) body: UpdateFinancialGoal,
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

  // ─── Contributions ────────────────────────────────────────

  @Get(":id/contributions")
  async listContributions(
    @CurrentUser() user: AuthUser,
    @ScopeHeader() hdr: string,
    @Param("id", ParseUUIDPipe) goalId: string,
  ) {
    const scope = await this.scopeResolver.resolve(user.id, hdr);
    return this.contributions.listForGoal(user.id, scope, goalId);
  }

  @Post(":id/contributions")
  async addContribution(
    @CurrentUser() user: AuthUser,
    @ScopeHeader() hdr: string,
    @Param("id", ParseUUIDPipe) goalId: string,
    @Body(new ZodValidationPipe(CreateContributionBodySchema))
    body: CreateContributionBody,
  ) {
    const scope = await this.scopeResolver.resolve(user.id, hdr);
    return this.contributions.create(user.id, scope, goalId, body);
  }

  @Delete(":id/contributions/:contributionId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeContribution(
    @CurrentUser() user: AuthUser,
    @ScopeHeader() hdr: string,
    @Param("id", ParseUUIDPipe) goalId: string,
    @Param("contributionId", ParseUUIDPipe) contributionId: string,
  ) {
    const scope = await this.scopeResolver.resolve(user.id, hdr);
    await this.contributions.softDelete(user.id, scope, goalId, contributionId);
  }
}
