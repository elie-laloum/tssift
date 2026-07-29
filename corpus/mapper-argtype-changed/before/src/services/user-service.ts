import type { User } from "../domain/user";
import { makeUser } from "../domain/user-factory";
import { render } from "../render/user-view";

export function describeUser(user: User): string {
  return render(user);
}

export function describeNewSignup(name: string, email: string): string {
  const user = makeUser(name, email);
  return render(user);
}
