import type { Money } from "../domain";

export interface LedgerLine {
  readonly memo: string;
  readonly value: Money;
}

export function totalLedger(lines: readonly LedgerLine[]): Money {
  const currencyCode = lines[0]?.value.currencyCode ?? "USD";
  const amountMinor = lines.reduce((sum, l) => sum + l.value.amountMinor, 0);
  return { amountMinor, currencyCode };
}
