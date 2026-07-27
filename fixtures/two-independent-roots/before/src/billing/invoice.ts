// Root B — a property that does not exist on a locally declared type. Declared
// here, used here: it shares no declaration site with src/reporting/export.ts.
interface LineItem {
  sku: string;
  quantityOrdered: number;
  unitPriceCents: number;
}

export function lineTotalCents(item: LineItem): number {
  return item.quantity * item.unitPriceCents;
}
