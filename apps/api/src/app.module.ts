import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { CommonModule } from "./common/common.module";
import { CouplesModule } from "./couples/couples.module";
import { DbModule } from "./db/db.module";
import { DietModule } from "./diet/diet.module";
import { FinanceModule } from "./finance/finance.module";
import { HealthModule } from "./health/health.module";
import { RoutinesModule } from "./routines/routines.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
    }),
    DbModule,
    CommonModule,
    AuthModule,
    UsersModule,
    CouplesModule,
    FinanceModule,
    RoutinesModule,
    DietModule,
    HealthModule,
  ],
})
export class AppModule {}
