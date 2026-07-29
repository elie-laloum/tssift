import type { Money } from "../domain";

export function refundAmount(original: Money, ratio: number): Money {
  return {
    amountMinor: Math.round(original.amountMinor * ratio),
    currencyCode: original.currencyCode,
  };
}
