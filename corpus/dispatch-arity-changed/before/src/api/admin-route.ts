import { emit } from "../events/dispatch";
import { adminActionTaken } from "../events/types";

export function performAdminAction(action: string): void {
  emit(adminActionTaken(action));
}
