import { formatMoney } from "../domain/money";
import type { Order } from "../domain/order";

export function renderOrderRow(order: Order): string {
  return `${order.id} — ${formatMoney(order.total, order.currency)}`;
}

export function orderRowClass(order: Order): string {
  return order.total > 1000 ? "row-large" : "row";
}
