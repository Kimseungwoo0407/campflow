import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Response } from "express";
import type { RequestContext } from "./request-context";

interface StructuredException {
  code?: string;
  message?: string | string[];
  details?: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestContext>();
    const response = context.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception instanceof HttpException ? exception.getResponse() : undefined;
    const structured = typeof raw === "object" && raw !== null ? (raw as StructuredException) : {};
    const defaultMessage =
      status === HttpStatus.INTERNAL_SERVER_ERROR
        ? "요청을 처리하는 중 문제가 발생했습니다."
        : typeof raw === "string"
          ? raw
          : "요청을 처리할 수 없습니다.";
    const rawMessage = structured.message;
    const message = Array.isArray(rawMessage) ? rawMessage.join(", ") : (rawMessage ?? defaultMessage);

    response.status(status).json({
      error: {
        code: structured.code ?? `HTTP_${status}`,
        message,
        ...(structured.details === undefined ? {} : { details: structured.details }),
        requestId: request.requestId,
      },
    });
  }
}
