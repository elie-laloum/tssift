import type { User } from "../domain/user";
import { render, renderCompact } from "../render/user-view";

export function fullReportRow(user: User): string {
  return render(user);
}

export function compactReportRow(user: User): string {
  return renderCompact(user);
}
