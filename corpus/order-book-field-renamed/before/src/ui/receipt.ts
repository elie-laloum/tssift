import type { Order } from "../domain/order";

export function receiptFooter(order: Order): string {
  return `Total due: ${order.total}`;
}

export function receiptSummary(order: Order): string {
  return `${order.lines.length} items, ${order.total} total`;
}
