import type { Money } from "../domain";

export function applyPercentDiscount(price: Money, percent: number): Money {
  const kept = 1 - percent / 100;
  return {
    amountMinor: Math.round(price.amountMinor * kept),
    currencyCode: price.currencyCode,
  };
}
