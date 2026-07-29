import type { Order } from "../domain/order";

export function orderRow(order: Order): string {
  return [order.id, order.currency, order.total].join(",");
}

export function ordersCsv(orders: Order[]): string {
  return orders.map((o) => `${o.id},${o.total}`).join("\n");
}
