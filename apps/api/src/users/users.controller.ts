import { Body, Controller, Get, Patch, UsePipes } from "@nestjs/common";
import {
  UpdateUserPreferencesSchema,
  type UpdateUserPreferences,
} from "@mi-centro/shared";
import { CurrentUser, type AuthUser } from "../auth/auth.decorators";
import { ZodValidationPipe } from "../common/zod.pipe";
import { UsersService } from "./users.service";

@Controller("me")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async me(@CurrentUser() user: AuthUser) {
    return this.users.findById(user.id);
  }

  @Patch()
  @UsePipes(new ZodValidationPipe(UpdateUserPreferencesSchema))
  async patch(
    @CurrentUser() user: AuthUser,
    @Body() body: UpdateUserPreferences,
  ) {
    return this.users.updatePreferences(user.id, body);
  }
}
