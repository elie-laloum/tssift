// Unchanged, and correct. `OrderId` is still exported from here — the break is
// in the barrel that re-exports it, one directory up.
export type OrderId = string & { readonly __brand: "OrderId" };

export interface Order {
  readonly id: OrderId;
  readonly totalCents: number;
}
