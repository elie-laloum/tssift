import type { User } from "../domain/user";
import { render } from "../render/user-view";

export function auditEntry(actor: User, action: string): string {
  return `${action} by ${render(actor)}`;
}
