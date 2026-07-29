import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthenticatedUser, RequestContext } from "../http/request-context";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<RequestContext>();
    if (!request.user) {
      throw new Error("인증 사용자 컨텍스트가 없습니다.");
    }
    return request.user;
  },
);
