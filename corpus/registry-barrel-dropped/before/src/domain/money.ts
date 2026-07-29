// The underlying module. It still exports `Money` correctly — this file is
// NOT the bug. The barrel next door stopped re-exporting `Money`, and that is
// the single root cause of the whole cascade.
export interface Money {
  readonly amountMinor: number;
  readonly currencyCode: string;
}

export function zeroMoney(currencyCode: string): Money {
  return { amountMinor: 0, currencyCode };
}
