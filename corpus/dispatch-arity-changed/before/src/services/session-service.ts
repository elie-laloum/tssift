import { emit } from "../events/dispatch";
import { sessionEnded, sessionStarted } from "../events/types";

export function startSession(sessionId: string): void {
  emit(sessionStarted(sessionId));
}

export function endSession(sessionId: string): void {
  emit(sessionEnded(sessionId));
}
