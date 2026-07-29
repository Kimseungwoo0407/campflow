import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import type { Observable } from "rxjs";
import { map } from "rxjs/operators";
import type { RequestContext } from "./request-context";

@Injectable()
export class EnvelopeInterceptor<T>
  implements NestInterceptor<T, { data: T; meta: { requestId: string; serverTime: string } }>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<{ data: T; meta: { requestId: string; serverTime: string } }> {
    const request = context.switchToHttp().getRequest<RequestContext>();
    return next.handle().pipe(
      map((data) => ({
        data,
        meta: {
          requestId: request.requestId,
          serverTime: new Date().toISOString(),
        },
      })),
    );
  }
}
