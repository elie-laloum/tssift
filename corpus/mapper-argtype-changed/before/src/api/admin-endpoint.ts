import type { User } from "../domain/user";
import { render } from "../render/user-view";

export function listAdmins(users: User[]): string[] {
  return users.map((user) => render(user));
}

export function showAdmin(name: string, email: string): string {
  const admin: User = { name, email, role: "admin" };
  return render(admin);
}
