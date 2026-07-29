import { emit } from "../events/dispatch";
import { itemReserved } from "../events/types";

export function reserveItem(sku: string, _quantity: number): void {
  emit(itemReserved(sku));
}
