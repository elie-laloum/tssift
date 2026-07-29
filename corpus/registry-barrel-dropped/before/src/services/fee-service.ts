import type { Money } from "../domain";

const FLAT_FEE_MINOR = 30;

export function applyFlatFee(gross: Money): Money {
  return {
    amountMinor: gross.amountMinor + FLAT_FEE_MINOR,
    currencyCode: gross.currencyCode,
  };
}
