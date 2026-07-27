import { isComplete, type Profile } from "../accounts/profile";

const anonymous: Profile = { id: "anon", displayName: "Anonymous" };

export function anonymousIsComplete(): boolean {
  return isComplete(anonymous);
}
