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
import {
  CreateRecurringTransactionSchema,
  UpdateRecurringTransactionSchema,
  type CreateRecurringTransaction,
  type UpdateRecurringTransaction,
} from "@mi-centro/shared";
import { CurrentUser, type AuthUser } from "../auth/auth.decorators";
import { ScopeHeader, ScopeResolver } from "../common/scope";
import { ZodValidationPipe } from "../common/zod.pipe";
import { RecurringService } from "./recurring.service";

@Controller("recurring-transactions")
export class RecurringController {
  constructor(
    private readonly svc: RecurringService,
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
    @Body(new ZodValidationPipe(CreateRecurringTransactionSchema))
    body: CreateRecurringTransaction,
  ) {
    const scope = await this.scopeResolver.resolve(user.id, hdr);
    return this.svc.create(user.id, scope, body);
  }

  @Patch(":id")
  async update(
    @CurrentUser() user: AuthUser,
    @ScopeHeader() hdr: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateRecurringTransactionSchema))
    body: UpdateRecurringTransaction,
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
}
