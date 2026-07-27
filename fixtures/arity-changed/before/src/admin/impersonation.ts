import { auditEvent } from "../audit/event";

export function impersonate(adminId: string, targetId: string): string {
  const event = auditEvent("admin.impersonate");
  return `${adminId}->${targetId}:${event.action}`;
}
