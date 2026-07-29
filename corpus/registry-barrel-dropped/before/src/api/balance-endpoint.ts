import type { Money } from "../domain";

export function serializeBalance(balance: Money): Record<string, unknown> {
  return {
    amount_minor: balance.amountMinor,
    currency: balance.currencyCode,
  };
}
