import { type Order, orderTotal } from "@domain/order";

export function monthlyRevenue(orders: Order[]): number {
  return orders.reduce((sum, order) => sum + orderTotal(order), 0);
}
