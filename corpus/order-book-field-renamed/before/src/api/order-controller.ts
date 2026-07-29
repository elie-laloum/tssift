import type { Order } from "../domain/order";

export function orderResponse(order: Order): { id: string; amount: number } {
  return { id: order.id, amount: order.total };
}

export function orderAmountHeader(order: Order): string {
  return String(order.total);
}
