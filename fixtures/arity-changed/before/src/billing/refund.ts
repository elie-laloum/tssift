import { auditEvent } from "../audit/event";

export function refund(orderId: string, cents: number): string {
  const event = auditEvent("billing.refund");
  return `${orderId}:${cents}:${event.action}`;
}
