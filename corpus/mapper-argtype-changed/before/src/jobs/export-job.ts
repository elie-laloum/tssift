import type { User } from "../domain/user";
import { renderCompact } from "../render/user-view";

export function exportRow(user: User): string {
  return renderCompact(user);
}
