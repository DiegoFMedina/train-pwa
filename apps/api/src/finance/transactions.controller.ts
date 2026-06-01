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
  Query,
} from "@nestjs/common";
import {
  CreateTransactionSchema,
  TransactionFilterSchema,
  UpdateTransactionSchema,
  type CreateTransaction,
  type TransactionFilter,
  type UpdateTransaction,
} from "@mi-centro/shared";
import { CurrentUser, type AuthUser } from "../auth/auth.decorators";
import { ScopeHeader, ScopeResolver } from "../common/scope";
import { ZodValidationPipe } from "../common/zod.pipe";
import { TransactionsService } from "./transactions.service";

@Controller("transactions")
export class TransactionsController {
  constructor(
    private readonly svc: TransactionsService,
    private readonly scopeResolver: ScopeResolver,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @ScopeHeader() hdr: string,
    @Query(new ZodValidationPipe(TransactionFilterSchema, { applyTo: ["query"] }))
    filter: TransactionFilter,
  ) {
    const scope = await this.scopeResolver.resolve(user.id, hdr);
    return this.svc.list(user.id, scope, filter);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @ScopeHeader() hdr: string,
    @Body(new ZodValidationPipe(CreateTransactionSchema)) body: CreateTransaction,
  ) {
    const scope = await this.scopeResolver.resolve(user.id, hdr);
    return this.svc.create(user.id, scope, body);
  }

  @Patch(":id")
  async update(
    @CurrentUser() user: AuthUser,
    @ScopeHeader() hdr: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateTransactionSchema)) body: UpdateTransaction,
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
