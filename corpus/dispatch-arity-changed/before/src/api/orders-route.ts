import { emit } from "../events/dispatch";
import { orderCancelled, orderPlaced } from "../events/types";

export function placeOrder(orderId: string): void {
  emit(orderPlaced(orderId));
}

export function cancelOrder(orderId: string): void {
  emit(orderCancelled(orderId));
}
