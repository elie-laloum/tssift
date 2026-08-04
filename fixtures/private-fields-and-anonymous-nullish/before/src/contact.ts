import { currentProfile } from "./session";

export function contactEmail(): string {
  return currentProfile().contact.email;
}
