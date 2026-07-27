import { auditEvent } from "../audit/event";

export function openSession(userId: string): string {
  const event = auditEvent("session.open");
  return `${userId}:${event.at}`;
}

export function closeSession(userId: string): string {
  const event = auditEvent("session.close");
  return `${userId}:${event.at}`;
}
