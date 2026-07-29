import type { Money } from "../domain";

export interface Tier {
  readonly threshold: Money;
  readonly label: string;
}

export function resolveTier(spend: Money, tiers: readonly Tier[]): string {
  const match = [...tiers]
    .sort((a, b) => b.threshold.amountMinor - a.threshold.amountMinor)
    .find((t) => spend.amountMinor >= t.threshold.amountMinor);
  return match?.label ?? "base";
}
