import type { Order } from "../domain/order";

export function reminderText(order: Order): string {
  return `You owe ${order.total} for order ${order.id}`;
}
