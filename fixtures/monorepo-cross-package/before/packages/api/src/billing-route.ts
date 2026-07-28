import type { Invoice } from "@acme/core";

export function billingPayload(invoice: Invoice): Record<string, unknown> {
  return {
    id: invoice.id,
    status: invoice.status,
    total: invoice.total,
  };
}
