import type { Money } from "../domain";

export interface AgingBucket {
  readonly daysOverdue: number;
  readonly outstanding: Money;
}

export function totalOutstanding(buckets: readonly AgingBucket[]): Money {
  const currencyCode = buckets[0]?.outstanding.currencyCode ?? "USD";
  return {
    amountMinor: buckets.reduce((s, b) => s + b.outstanding.amountMinor, 0),
    currencyCode,
  };
}
