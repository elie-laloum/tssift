import type { Money } from "../domain";

export function convert(amount: Money, targetCurrency: string, fxRate: number): Money {
  return {
    amountMinor: Math.round(amount.amountMinor * fxRate),
    currencyCode: targetCurrency,
  };
}
