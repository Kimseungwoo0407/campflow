import { randomUUID } from "node:crypto";
import type { NextFunction, Response } from "express";
import type { RequestContext } from "./request-context";

const requestIdPattern = /^[a-zA-Z0-9._:-]{8,128}$/;

export function requestContextMiddleware(
  request: RequestContext,
  response: Response,
  next: NextFunction,
): void {
  const supplied = request.header("x-request-id");
  request.requestId = supplied && requestIdPattern.test(supplied) ? supplied : randomUUID();
  response.setHeader("x-request-id", request.requestId);
  next();
}
