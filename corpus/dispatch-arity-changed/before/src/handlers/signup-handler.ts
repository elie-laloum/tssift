import { emit } from "../events/dispatch";
import { signupCompleted } from "../events/types";

export function handleSignup(email: string): void {
  emit(signupCompleted(email));
}
