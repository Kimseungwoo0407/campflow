import type { Request } from "express";

export interface AuthenticatedUser {
  id: string;
  email: string;
  sessionId: string;
}

export interface RequestContext extends Request {
  requestId: string;
  user?: AuthenticatedUser;
}
