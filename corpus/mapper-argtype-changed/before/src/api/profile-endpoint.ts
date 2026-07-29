import type { User } from "../domain/user";
import { makeUser, withRole } from "../domain/user-factory";
import { render, renderCompact } from "../render/user-view";

export function getProfile(name: string, email: string): string {
  const user: User = makeUser(name, email);
  return render(user);
}

export function getProfileBadge(name: string, email: string): string {
  const user = withRole(makeUser(name, email), "admin");
  return renderCompact(user);
}
