// Consumer 3 of 3. `CustomerId` still resolves through the barrel, so this file
// proves the barrel itself is reachable and only one of its exports is missing.
import type { CustomerId, OrderId } from "../domain";

export function summaryKey(customer: CustomerId, order: OrderId): string {
  return `${customer}/${order}`;
}
