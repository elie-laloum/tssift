import type { Money } from "../domain";

export interface CheckoutRequest {
  readonly cartId: string;
  readonly total: Money;
}

export function describeCheckout(req: CheckoutRequest): string {
  return `cart ${req.cartId}: ${req.total.amountMinor} ${req.total.currencyCode}`;
}
