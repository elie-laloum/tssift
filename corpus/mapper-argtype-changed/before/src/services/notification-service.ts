import type { User } from "../domain/user";
import { render } from "../render/user-view";

export function welcomeLine(user: User): string {
  return `Welcome, ${render(user)}`;
}

export function digestLine(users: User[]): string {
  return users.map((user) => render(user)).join("\n");
}
