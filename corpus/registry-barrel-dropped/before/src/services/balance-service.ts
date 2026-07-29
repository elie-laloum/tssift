import type { Money } from "../domain";

export function isNegative(m: Money): boolean {
  return m.amountMinor < 0;
}

export function abs(m: Money): Money {
  return { amountMinor: Math.abs(m.amountMinor), currencyCode: m.currencyCode };
}
