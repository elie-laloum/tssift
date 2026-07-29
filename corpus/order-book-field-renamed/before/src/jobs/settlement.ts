import type { Order } from "../domain/order";

export function settlementAmount(order: Order): number {
  return order.total;
}

export function batchSettlement(orders: Order[]): number {
  return orders.reduce((acc, o) => acc + o.total, 0);
}
