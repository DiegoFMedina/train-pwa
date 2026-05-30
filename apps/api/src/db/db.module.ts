import { Global, Module, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export const DB = Symbol("DB");
export type Db = NodePgDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: DB,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.getOrThrow<string>("DATABASE_URL");
        const pool = new Pool({ connectionString: url, max: 10 });
        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DB],
})
export class DbModule implements OnModuleDestroy {
  onModuleDestroy(): void {
    // Pool se cierra automáticamente al apagar el proceso; nada que hacer aquí.
  }
}
