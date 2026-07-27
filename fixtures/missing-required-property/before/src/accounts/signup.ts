import type { Profile } from "./profile";

export function newProfile(id: string, displayName: string): Profile {
  return { id, displayName };
}
