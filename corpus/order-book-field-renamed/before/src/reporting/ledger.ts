import type { Order } from "../domain/order";

export function ledgerEntry(order: Order): { debit: number; credit: number } {
  return { debit: order.total, credit: 0 };
}

export function runningBalance(orders: Order[]): number {
  let balance = 0;
  for (const o of orders) {
    balance += o.total;
  }
  return balance;
}
