import { emit } from "../events/dispatch";
import { profileUpdated } from "../events/types";

export function updateProfile(userId: string, _patch: Record<string, unknown>): void {
  emit(profileUpdated(userId));
}
