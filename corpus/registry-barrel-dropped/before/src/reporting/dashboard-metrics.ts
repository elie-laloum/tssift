import type { Money } from "../domain";

export function averageOrderValue(totalRevenue: Money, orderCount: number): Money {
  return {
    amountMinor: orderCount === 0 ? 0 : Math.round(totalRevenue.amountMinor / orderCount),
    currencyCode: totalRevenue.currencyCode,
  };
}
