import type { Invoice } from "@acme/core";

export function isOverdue(invoice: Invoice, paidCents: number): boolean {
  return invoice.status !== "paid" && paidCents < invoice.total;
}
