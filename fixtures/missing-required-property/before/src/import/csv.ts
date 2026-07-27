import { isComplete, type Profile } from "../accounts/profile";

export function fromRow(row: string[]): boolean {
  const profile: Profile = { id: row[0] ?? "", displayName: row[1] ?? "" };
  return isComplete(profile);
}
