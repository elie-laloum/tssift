import type { Money } from "../domain";

export interface Plan {
  readonly name: string;
  readonly monthly: Money;
}

export function annualCost(plan: Plan): Money {
  return {
    amountMinor: plan.monthly.amountMinor * 12,
    currencyCode: plan.monthly.currencyCode,
  };
}
