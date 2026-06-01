import { Global, Module } from "@nestjs/common";
import { ScopeResolver } from "./scope";

@Global()
@Module({
  providers: [ScopeResolver],
  exports: [ScopeResolver],
})
export class CommonModule {}
