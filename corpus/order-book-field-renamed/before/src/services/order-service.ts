import type { Order } from "../domain/order";

export function orderBalance(order: Order, paid: number): number {
  return order.total - paid;
}

export function isFullyPaid(order: Order, paid: number): boolean {
  return paid >= order.total;
}
