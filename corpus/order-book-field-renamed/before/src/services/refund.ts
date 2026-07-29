import type { Order } from "../domain/order";

export function fullRefundAmount(order: Order): number {
  return order.total;
}

export function partialRefund(order: Order, fraction: number): number {
  return order.total * fraction;
}
