import type { Money } from "../domain";

export function marginMinor(revenue: Money, cost: Money): number {
  return revenue.amountMinor - cost.amountMinor;
}
