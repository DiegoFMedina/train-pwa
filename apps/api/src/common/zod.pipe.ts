import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
  Paramtype,
} from "@nestjs/common";
import type { ZodTypeAny, infer as ZodInfer } from "zod";

interface ZodPipeOptions {
  /** Tipos de parámetro sobre los que actúa. Default: ['body']. */
  applyTo?: Paramtype[];
}

/**
 * Valida payloads contra un schema Zod. Por defecto solo actúa sobre @Body()
 * — esto evita que `@UsePipes()` a nivel de método pise parámetros custom
 * como @CurrentUser(). Para validar query strings o params, pasar applyTo.
 */
export class ZodValidationPipe<T extends ZodTypeAny> implements PipeTransform {
  private readonly applyTo: ReadonlySet<Paramtype>;

  constructor(
    private readonly schema: T,
    options: ZodPipeOptions = {},
  ) {
    this.applyTo = new Set(options.applyTo ?? ["body"]);
  }

  transform(value: unknown, metadata: ArgumentMetadata): ZodInfer<T> | unknown {
    if (!this.applyTo.has(metadata.type)) return value;

    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: "Validación fallida",
        issues: result.error.issues.map((i) => ({
          path: i.path.join("."),
          code: i.code,
          message: i.message,
        })),
      });
    }
    return result.data;
  }
}
