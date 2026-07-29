export type OrderStatus = "draft" | "placed" | "paid" | "shipped" | "cancelled";

export function isFinal(status: OrderStatus): boolean {
  return status === "shipped" || status === "cancelled";
}
