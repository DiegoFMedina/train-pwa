import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
} from "@nestjs/common";
import type { ZodTypeAny, infer as ZodInfer } from "zod";

/**
 * Valida payloads contra un schema Zod. Solo actúa sobre @Body() — devuelve
 * sin tocar cualquier otro tipo de parámetro (param, query, custom como
 * @CurrentUser). Esto permite usar @UsePipes(...) a nivel de método sin
 * que el schema "limpie" argumentos que no le corresponden.
 */
export class ZodValidationPipe<T extends ZodTypeAny> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown, metadata: ArgumentMetadata): ZodInfer<T> | unknown {
    if (metadata.type !== "body") return value;

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
