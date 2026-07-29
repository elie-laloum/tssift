import type { Money } from "../domain";

export interface PaymentEvent {
  readonly eventId: string;
  readonly captured: Money;
}

export function isFullyCaptured(event: PaymentEvent, expected: Money): boolean {
  return event.captured.amountMinor >= expected.amountMinor;
}
