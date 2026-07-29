import type { User } from "../domain/user";
import { makeUser } from "../domain/user-factory";
import { render } from "../render/user-view";

export function buildDigest(users: User[]): string {
  return users.map((user) => render(user)).join("\n");
}

export function digestPreview(): string {
  const sample = makeUser("Sample", "sample@example.test");
  return render(sample);
}
