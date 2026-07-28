export interface Order {
  id: string;
  lines: OrderLine[];
}

export interface OrderLine {
  sku: string;
  quantity: number;
  unitPrice: number;
}

export function orderTotal(order: Order): number {
  return order.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
}
