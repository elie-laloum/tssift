import type { Money } from "../domain";

export function roundToUnit(m: Money): Money {
  return {
    amountMinor: Math.round(m.amountMinor / 100) * 100,
    currencyCode: m.currencyCode,
  };
}
