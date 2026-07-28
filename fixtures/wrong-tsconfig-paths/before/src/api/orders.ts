import { type Order, orderTotal } from "@domain/order";

export function orderSummary(order: Order): string {
  return `${order.id}: ${orderTotal(order).toFixed(2)}`;
}
