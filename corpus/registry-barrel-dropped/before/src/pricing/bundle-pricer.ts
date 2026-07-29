import type { Money } from "../domain";

export function sumPrices(prices: readonly Money[]): Money {
  const currencyCode = prices[0]?.currencyCode ?? "USD";
  return {
    amountMinor: prices.reduce((s, p) => s + p.amountMinor, 0),
    currencyCode,
  };
}
