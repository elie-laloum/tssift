// Consumer 1 of 3. Imports `Order` (fine) and `OrderId` (gone from the barrel).
import type { Order, OrderId } from "../domain";

export function invoiceReference(id: OrderId): string {
  return `INV-${id}`;
}

export function invoiceTotalCents(order: Order): number {
  return order.totalCents;
}
