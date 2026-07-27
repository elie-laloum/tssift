import { OrderStatus } from "../domain/order-status";

export function describe(status: OrderStatus): string {
  return `order is ${status}`;
}
