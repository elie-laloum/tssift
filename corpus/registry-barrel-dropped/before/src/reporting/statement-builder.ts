import type { Money } from "../domain";

export function formatStatementLine(label: string, amount: Money): string {
  return `${label}\t${amount.currencyCode} ${(amount.amountMinor / 100).toFixed(2)}`;
}
