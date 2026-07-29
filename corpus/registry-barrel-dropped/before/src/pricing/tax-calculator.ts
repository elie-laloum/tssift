import type { Money } from "../domain";

export function withTax(net: Money, rate: number): Money {
  return {
    amountMinor: Math.round(net.amountMinor * (1 + rate)),
    currencyCode: net.currencyCode,
  };
}
