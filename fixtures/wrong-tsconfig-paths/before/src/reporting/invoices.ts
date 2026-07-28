import type { Order } from "@domain/order";

export function invoiceNumbers(orders: Order[]): string[] {
  return orders.map((order) => `INV-${order.id}`);
}
