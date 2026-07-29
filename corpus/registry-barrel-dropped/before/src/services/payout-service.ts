import type { Money } from "../domain";

export function splitPayout(total: Money, parts: number): Money[] {
  const each = Math.floor(total.amountMinor / parts);
  return Array.from({ length: parts }, () => ({
    amountMinor: each,
    currencyCode: total.currencyCode,
  }));
}
