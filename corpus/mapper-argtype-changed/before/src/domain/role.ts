/**
 * The three roles a user can hold. Split into its own module so that both the
 * in-memory `User` and the stored `PersistedUser` share one definition; nothing
 * here is defective.
 */

export type Role = "admin" | "member" | "guest";

export function isPrivileged(role: Role): boolean {
  return role === "admin";
}
