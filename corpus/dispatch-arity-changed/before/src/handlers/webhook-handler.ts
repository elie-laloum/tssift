import { emit } from "../events/dispatch";
import { webhookProcessed, webhookReceived } from "../events/types";

export function handleWebhook(source: string): void {
  emit(webhookReceived(source));
  // ... verify signature, route the payload ...
  emit(webhookProcessed(source));
}
