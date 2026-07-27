/**
 * The root cause. `auditEvent` gained a required second parameter, `actor`,
 * when audit records started carrying who performed the action. The three call
 * sites in this project were never updated.
 */

export interface AuditEvent {
  action: string;
  actor: string;
  at: number;
}

export function auditEvent(action: string, actor: string): AuditEvent {
  return { action, actor, at: 0 };
}
