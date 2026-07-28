// A second consumer, so the missing `type` modifier is a cross-file pattern and
// not a single slip: same shape, same fix, a different file.
import { User } from "../model/user";

export function auditActor(u: User): string {
  return u.id;
}
