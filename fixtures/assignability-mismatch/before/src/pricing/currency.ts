/**
 * The root cause. `Currency` used to include "GBP"; the member was dropped when
 * the UK price list was retired. Three modules still build rates in it.
 */

export type Currency = "EUR" | "USD";

export interface Rate {
  currency: Currency;
  amount: number;
}
