import type { Order } from "../domain/order";

export function totalBadge(order: Order): string {
  return order.total >= 500 ? "gold" : "standard";
}
