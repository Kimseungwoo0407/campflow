import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import type { RequestContext } from "../common/http/request-context";

export const CSRF_COOKIE_NAME = "campflow_csrf";

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestContext>();
    const cookie = request.cookies[CSRF_COOKIE_NAME] as string | undefined;
    const header = request.header("x-csrf-token");

    if (!cookie || !header || !this.equals(cookie, header)) {
      throw new ForbiddenException({
        code: "CSRF_CHECK_FAILED",
        message: "요청 출처를 확인할 수 없습니다. 페이지를 새로고침해 주세요.",
      });
    }
    return true;
  }

  private equals(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }
}
