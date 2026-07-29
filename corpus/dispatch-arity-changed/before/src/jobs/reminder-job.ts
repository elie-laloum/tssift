import { emit } from "../events/dispatch";
import { reminderQueued } from "../events/types";

export function runReminders(userIds: string[]): void {
  for (const userId of userIds) {
    emit(reminderQueued(userId));
  }
}
