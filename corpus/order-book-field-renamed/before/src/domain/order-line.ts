export interface OrderLine {
  sku: string;
  quantity: number;
  unitPrice: number;
}

export function lineSubtotal(line: OrderLine): number {
  return line.quantity * line.unitPrice;
}
