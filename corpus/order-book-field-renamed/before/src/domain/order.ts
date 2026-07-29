import type { Currency } from "./money";
import type { OrderLine } from "./order-line";
import type { OrderStatus } from "./order-status";

export interface Order {
  id: string;
  customerId: string;
  lines: OrderLine[];
  /**
   * Total charged to the customer, including tax and shipping.
   * Renamed from `total` to disambiguate from line-item subtotals.
   */
  grandTotal: number;
  currency: Currency;
  status: OrderStatus;
  createdAt: string;
}
