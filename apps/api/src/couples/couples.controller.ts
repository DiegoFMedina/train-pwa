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
  AcceptInvitationSchema,
  CreateCoupleSchema,
  CreateInvitationSchema,
  UpdateCoupleSchema,
  type AcceptInvitation,
  type CreateCouple,
  type CreateInvitation,
  type UpdateCouple,
} from "@mi-centro/shared";
import { CurrentUser, type AuthUser } from "../auth/auth.decorators";
import { ZodValidationPipe } from "../common/zod.pipe";
import { CouplesService } from "./couples.service";

@Controller("couples")
export class CouplesController {
  constructor(private readonly svc: CouplesService) {}

  /** Mi pareja actual o null. */
  @Get("me")
  myCouple(@CurrentUser() user: AuthUser) {
    return this.svc.myCouple(user.id);
  }

  /** Crea una nueva pareja, el creador queda como owner. */
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateCoupleSchema)) body: CreateCouple,
  ) {
    return this.svc.create(user.id, body.name);
  }

  @Patch(":id")
  rename(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateCoupleSchema)) body: UpdateCouple,
  ) {
    return this.svc.rename(user.id, id, body.name);
  }

  /** Borrar la pareja (solo owner). */
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    await this.svc.deleteOwnedCouple(user.id, id);
  }

  /** Salirse uno mismo de la pareja (no owner). */
  @Post(":id/leave")
  @HttpCode(HttpStatus.NO_CONTENT)
  async leave(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    await this.svc.leave(user.id, id);
  }

  /** Owner expulsa a un miembro. */
  @Delete(":id/members/:userId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async kick(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) coupleId: string,
    @Param("userId", ParseUUIDPipe) targetUserId: string,
  ) {
    await this.svc.kick(user.id, coupleId, targetUserId);
  }

  // ─── Invitaciones ──────────────────────────────────────────

  @Post(":id/invitations")
  createInvitation(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) coupleId: string,
    @Body(new ZodValidationPipe(CreateInvitationSchema)) body: CreateInvitation,
  ) {
    return this.svc.createInvitation(user.id, coupleId, body.ttl_hours);
  }

  @Get(":id/invitations")
  listInvitations(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) coupleId: string,
  ) {
    return this.svc.listInvitations(user.id, coupleId);
  }

  @Delete("invitations/:invitationId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeInvitation(
    @CurrentUser() user: AuthUser,
    @Param("invitationId", ParseUUIDPipe) invitationId: string,
  ) {
    await this.svc.revokeInvitation(user.id, invitationId);
  }

  /** Aceptar invitación con código. No requiere conocer el coupleId. */
  @Post("join")
  join(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(AcceptInvitationSchema)) body: AcceptInvitation,
  ) {
    return this.svc.accept(user.id, body.code);
  }
}
