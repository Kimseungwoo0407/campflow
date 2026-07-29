import { BadRequestException, type PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "입력값을 확인해 주세요.",
        details: result.error.flatten(),
      });
    }
    return result.data;
  }
}
