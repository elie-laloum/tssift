import { emit } from "../events/dispatch";
import { invoiceIssued, paymentCaptured } from "../events/types";

export function issueInvoice(invoiceId: string, amount: number): void {
  emit(invoiceIssued(invoiceId, amount));
}

export function capturePayment(paymentId: string): void {
  emit(paymentCaptured(paymentId));
}
