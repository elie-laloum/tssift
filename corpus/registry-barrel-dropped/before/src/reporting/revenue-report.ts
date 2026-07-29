import type { Money } from "../domain";

export interface RevenueRow {
  readonly period: string;
  readonly gross: Money;
}

export function grossTotal(rows: readonly RevenueRow[]): Money {
  const currencyCode = rows[0]?.gross.currencyCode ?? "USD";
  return {
    amountMinor: rows.reduce((s, r) => s + r.gross.amountMinor, 0),
    currencyCode,
  };
}
