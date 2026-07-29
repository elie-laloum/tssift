import type { Money } from "../domain";

export interface QuoteResponse {
  readonly quoteId: string;
  readonly price: Money;
}

export function emptyQuote(quoteId: string): QuoteResponse {
  return { quoteId, price: { amountMinor: 0, currencyCode: "USD" } };
}
