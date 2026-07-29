/**
 * Small constructors for in-memory `User` values, so call sites read cleanly.
 * Every value produced here is a complete, well-formed `User`; none of them is
 * a `PersistedUser`, because none of this code touches storage.
 */

import type { Role } from "./role";
import type { User } from "./user";

export function makeUser(name: string, email: string, role: Role = "member"): User {
  return { name, email, role };
}

export function makeGuest(email: string): User {
  return { name: "Guest", email, role: "guest" };
}

export function withRole(user: User, role: Role): User {
  return { ...user, role };
}
