import type { Rate } from "../pricing/currency";

export function quote(amount: number): Rate {
  return { currency: "GBP", amount };
}
