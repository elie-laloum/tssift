import { OrderStatus } from "../domain/order-status";

export function keepClosed(statuses: OrderStatus[]): OrderStatus[] {
  return statuses.filter((status) => status === OrderStatus.Closed);
}
