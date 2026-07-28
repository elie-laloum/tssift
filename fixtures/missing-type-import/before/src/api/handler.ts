// `User` and `Session` are types, imported as values. With
// `verbatimModuleSyntax` on, each must be a type-only import — the fix is the
// `type` modifier, not a new dependency.
import { User, Session } from "../model/user";

export function greet(u: User): string {
  return `hello ${u.email}`;
}

export function sessionOwner(s: Session): User {
  return s.user;
}
