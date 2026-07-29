import type { Order } from "../domain/order";

export function taxComponent(order: Order, rate: number): number {
  return order.total - order.total / (1 + rate);
}
