import type { User } from "../domain/user";
import { makeGuest } from "../domain/user-factory";
import { render } from "../render/user-view";

export function previewSearchHit(email: string): string {
  const guest: User = makeGuest(email);
  return render(guest);
}
