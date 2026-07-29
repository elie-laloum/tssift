import { emit } from "../events/dispatch";
import { passwordResetRequested } from "../events/types";

export function handlePasswordReset(email: string): void {
  emit(passwordResetRequested(email));
}
