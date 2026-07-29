import type { Money } from "../domain";

export interface OrderPayload {
  readonly orderId: string;
  readonly grandTotal: Money;
}

export function orderTotalCents(payload: OrderPayload): number {
  return payload.grandTotal.amountMinor;
}
