// Consumer 2 of 3. Imports the same symbol as the other two — which is the
// whole point of this fixture (see meta.json).
import type { OrderId } from "../domain";

export function shippingLabelFor(id: OrderId): string {
  return `LBL-${id}`;
}
