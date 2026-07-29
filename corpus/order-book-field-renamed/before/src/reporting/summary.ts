import type { Order } from "../domain/order";

export function sumOrders(orders: Order[]): number {
  return orders.reduce((acc, o) => acc + o.total, 0);
}

export function averageOrder(orders: Order[]): number {
  const total = orders.reduce((acc, o) => acc + o.total, 0);
  return orders.length === 0 ? 0 : total / orders.length;
}
