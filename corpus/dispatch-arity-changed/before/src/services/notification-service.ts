import { emit } from "../events/dispatch";
import { notificationSent } from "../events/types";

export function notify(channel: string, _message: string): void {
  // ... deliver over the channel ...
  emit(notificationSent(channel));
}
