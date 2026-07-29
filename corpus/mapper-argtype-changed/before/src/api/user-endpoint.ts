import type { User } from "../domain/user";
import { makeUser } from "../domain/user-factory";
import { render } from "../render/user-view";

export function getUserView(name: string, email: string): string {
  const user = makeUser(name, email, "member");
  return render(user);
}

export function getAdminView(name: string, email: string): string {
  const user: User = { name, email, role: "admin" };
  return render(user);
}
