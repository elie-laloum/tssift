import { emit } from "../events/dispatch";
import { loginSucceeded } from "../events/types";

export function handleLogin(userId: string): void {
  emit(loginSucceeded(userId));
}
