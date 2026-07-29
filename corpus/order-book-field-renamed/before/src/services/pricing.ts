import type { Order } from "../domain/order";

export function applyDiscount(order: Order, rate: number): number {
  return order.total * (1 - rate);
}

export function priceWithTip(order: Order, tip: number): number {
  return order.total + tip;
}
