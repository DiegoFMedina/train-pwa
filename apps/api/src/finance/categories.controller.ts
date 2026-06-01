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
  CreateCategorySchema,
  UpdateCategorySchema,
  type CreateCategory,
  type UpdateCategory,
} from "@mi-centro/shared";
import { CurrentUser, type AuthUser } from "../auth/auth.decorators";
import { ScopeHeader, ScopeResolver } from "../common/scope";
import { ZodValidationPipe } from "../common/zod.pipe";
import { CategoriesService } from "./categories.service";

@Controller("categories")
export class CategoriesController {
  constructor(
    private readonly svc: CategoriesService,
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
    @Body(new ZodValidationPipe(CreateCategorySchema)) body: CreateCategory,
  ) {
    const scope = await this.scopeResolver.resolve(user.id, hdr);
    return this.svc.create(user.id, scope, body);
  }

  @Patch(":id")
  async update(
    @CurrentUser() user: AuthUser,
    @ScopeHeader() hdr: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateCategorySchema)) body: UpdateCategory,
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
