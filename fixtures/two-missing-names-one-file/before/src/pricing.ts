// Two unrelated failures in one file, and neither is a variant of the other.
//
// `Cents` was a shared alias that lived in src/money.ts. That module was deleted
// in a refactor and its import removed from here, but the three references to
// the name were left behind. Restoring the alias settles all three.
//
// `TaxRates` is a misspelling of `TaxRate`, declared two lines below. Its two
// references fail for an entirely different reason and take an entirely
// different fix — and because a close name is in scope, TypeScript reports them
// under a different code than the `Cents` ones.

export type TaxRate = number;

export interface LineItem {
  unitPrice: Cents;
  quantity: number;
}

export function subtotal(item: LineItem): Cents {
  return item.unitPrice * item.quantity;
}

export function applyTax(amount: Cents, rate: TaxRates): number {
  return amount * (1 + rate);
}

export function defaultRate(): TaxRates {
  return 0.2;
}
