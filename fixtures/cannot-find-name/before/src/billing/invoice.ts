// `Cents` was a shared alias that lived in src/money.ts. That module was
// deleted in a refactor and its import was removed here, but the six references
// to the name were not. Every one of them is now an undeclared name.
export interface Invoice {
  subtotal: Cents;
  tax: Cents;
  total: Cents;
}

export function net(invoice: Invoice): Cents {
  return invoice.subtotal;
}

export function addCents(a: Cents, b: Cents): Cents {
  return a + b;
}
