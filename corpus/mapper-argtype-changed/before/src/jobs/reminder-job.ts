import type { User } from "../domain/user";
import { makeUser } from "../domain/user-factory";
import { render } from "../render/user-view";

export function reminderLine(user: User): string {
  return `Reminder for ${render(user)}`;
}

export function reminderForEmail(email: string): string {
  const user = makeUser("Member", email);
  return render(user);
}
