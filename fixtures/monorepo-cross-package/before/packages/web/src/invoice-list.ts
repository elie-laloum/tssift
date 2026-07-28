import type { Invoice } from "@acme/core";

export function listTotal(invoices: Invoice[]): number {
  return invoices.reduce((sum, invoice) => sum + invoice.total, 0);
}
