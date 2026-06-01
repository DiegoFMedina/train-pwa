import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { CurrentUser, type AuthUser } from "../auth/auth.decorators";
import { ScopeHeader, ScopeResolver } from "../common/scope";
import { SummaryService } from "./summary.service";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

@Controller("finance/summary")
export class SummaryController {
  constructor(
    private readonly svc: SummaryService,
    private readonly scopeResolver: ScopeResolver,
  ) {}

  @Get()
  async monthly(
    @CurrentUser() user: AuthUser,
    @ScopeHeader() hdr: string,
    @Query("month") month?: string,
  ) {
    const m = month ?? currentMonth();
    if (!MONTH_RE.test(m)) {
      throw new BadRequestException(`month inválido: ${m} (esperado YYYY-MM)`);
    }
    const scope = await this.scopeResolver.resolve(user.id, hdr);
    return this.svc.monthly(user.id, scope, m);
  }
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
