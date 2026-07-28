export type InvoiceStatus = "draft" | "issued" | "paid";

export interface Invoice {
  id: string;
  status: InvoiceStatus;
  currency: string;
  amountDue: number;
}

export function issue(invoice: Invoice): Invoice {
  return { ...invoice, status: "issued" };
}
