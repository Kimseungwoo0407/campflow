import type { GroupRole } from "@campflow/contracts";
import { ulid } from "ulid";

export function newId(): string {
  return ulid();
}

export function canReadGroup(role: GroupRole | undefined): boolean {
  return role === "OWNER" || role === "MEMBER" || role === "GUEST";
}

export function canManageGroup(role: GroupRole | undefined): boolean {
  return role === "OWNER";
}

export function canWriteGroupContent(role: GroupRole | undefined): boolean {
  return role === "OWNER" || role === "MEMBER";
}

export function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase("en-US");
}
