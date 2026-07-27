import { OrderStatus } from "../domain/order-status";

export function isOpen(status: OrderStatus): boolean {
  return status === OrderStatus.Open;
}
