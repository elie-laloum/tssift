import type { Invoice } from "@acme/core";

export function invoiceCardLabel(invoice: Invoice): string {
  return `${invoice.id} — ${invoice.total} ${invoice.currency}`;
}
