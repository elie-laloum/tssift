import type { Order } from "../domain/order";

export function largestOrder(orders: Order[]): number {
  return orders.reduce((max, o) => Math.max(max, o.total), 0);
}
