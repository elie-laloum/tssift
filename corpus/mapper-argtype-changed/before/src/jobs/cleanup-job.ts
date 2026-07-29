import type { User } from "../domain/user";
import { render } from "../render/user-view";

export function logPurgedUser(user: User): string {
  return `purged ${render(user)}`;
}
