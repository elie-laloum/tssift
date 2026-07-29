import type { Money } from "../domain";

export interface InvoiceView {
  readonly number: string;
  readonly amountDue: Money;
}

export function renderAmountDue(view: InvoiceView): string {
  return `${view.amountDue.currencyCode} ${(view.amountDue.amountMinor / 100).toFixed(2)}`;
}
