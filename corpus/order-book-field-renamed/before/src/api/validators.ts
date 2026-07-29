import type { Order } from "../domain/order";

export function hasPositiveTotal(order: Order): boolean {
  return order.total > 0;
}
