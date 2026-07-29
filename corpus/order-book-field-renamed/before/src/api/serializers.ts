import type { Order } from "../domain/order";

export function toJson(order: Order): string {
  return JSON.stringify({ id: order.id, total: order.total });
}

export function toCompact(order: Order): string {
  return `${order.id}:${order.total}`;
}
