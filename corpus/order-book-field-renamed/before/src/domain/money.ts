export type Currency = "USD" | "EUR" | "GBP";

export function formatMoney(amount: number, currency: Currency): string {
  return `${amount.toFixed(2)} ${currency}`;
}

export function addMoney(a: number, b: number): number {
  return Math.round((a + b) * 100) / 100;
}
