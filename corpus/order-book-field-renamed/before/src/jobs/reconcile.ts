import type { Order } from "../domain/order";

export function isReconciled(order: Order, bankAmount: number): boolean {
  return order.total === bankAmount;
}

export function discrepancy(order: Order, bankAmount: number): number {
  return order.total - bankAmount;
}
