import { Controller, Get, Inject } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DB, type Db } from "../db/db.module";

@Controller("health")
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  async check() {
    const started = Date.now();
    await this.db.execute(sql`SELECT 1`);
    return {
      status: "ok",
      db_latency_ms: Date.now() - started,
      uptime_s: Math.round(process.uptime()),
    };
  }
}
