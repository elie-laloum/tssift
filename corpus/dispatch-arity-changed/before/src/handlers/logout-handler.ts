import { emit } from "../events/dispatch";
import { loggedOut } from "../events/types";

export function handleLogout(userId: string): void {
  emit(loggedOut(userId));
}
