import { emit } from "../events/dispatch";
import { userViewed } from "../events/types";

export function getUser(userId: string): { id: string } {
  emit(userViewed(userId));
  return { id: userId };
}
