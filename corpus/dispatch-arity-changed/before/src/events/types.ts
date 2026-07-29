/**
 * The shared domain-event shape and the small set of typed constructors used
 * across the codebase. Nothing here is broken; the constructors exist so that
 * call sites read cleanly and so the only defect in this project is the arity
 * of `emit` (see ./dispatch).
 */

export interface DomainEvent {
  type: string;
  payload: Record<string, unknown>;
  at: number;
}

export function accountCreated(userId: string): DomainEvent {
  return { type: "account.created", payload: { userId }, at: 0 };
}

export function accountDeleted(userId: string): DomainEvent {
  return { type: "account.deleted", payload: { userId }, at: 0 };
}

export function invoiceIssued(invoiceId: string, amount: number): DomainEvent {
  return { type: "invoice.issued", payload: { invoiceId, amount }, at: 0 };
}

export function paymentCaptured(paymentId: string): DomainEvent {
  return { type: "payment.captured", payload: { paymentId }, at: 0 };
}

export function notificationSent(channel: string): DomainEvent {
  return { type: "notification.sent", payload: { channel }, at: 0 };
}

export function profileUpdated(userId: string): DomainEvent {
  return { type: "profile.updated", payload: { userId }, at: 0 };
}

export function sessionStarted(sessionId: string): DomainEvent {
  return { type: "session.started", payload: { sessionId }, at: 0 };
}

export function sessionEnded(sessionId: string): DomainEvent {
  return { type: "session.ended", payload: { sessionId }, at: 0 };
}

export function itemReserved(sku: string): DomainEvent {
  return { type: "item.reserved", payload: { sku }, at: 0 };
}

export function signupCompleted(email: string): DomainEvent {
  return { type: "signup.completed", payload: { email }, at: 0 };
}

export function loginSucceeded(userId: string): DomainEvent {
  return { type: "login.succeeded", payload: { userId }, at: 0 };
}

export function loggedOut(userId: string): DomainEvent {
  return { type: "session.logout", payload: { userId }, at: 0 };
}

export function passwordResetRequested(email: string): DomainEvent {
  return { type: "password.reset_requested", payload: { email }, at: 0 };
}

export function webhookReceived(source: string): DomainEvent {
  return { type: "webhook.received", payload: { source }, at: 0 };
}

export function webhookProcessed(source: string): DomainEvent {
  return { type: "webhook.processed", payload: { source }, at: 0 };
}

export function staleRecordsPurged(count: number): DomainEvent {
  return { type: "records.purged", payload: { count }, at: 0 };
}

export function digestGenerated(period: string): DomainEvent {
  return { type: "digest.generated", payload: { period }, at: 0 };
}

export function reminderQueued(userId: string): DomainEvent {
  return { type: "reminder.queued", payload: { userId }, at: 0 };
}

export function ledgerReconciled(batchId: string): DomainEvent {
  return { type: "ledger.reconciled", payload: { batchId }, at: 0 };
}

export function userViewed(userId: string): DomainEvent {
  return { type: "user.viewed", payload: { userId }, at: 0 };
}

export function orderPlaced(orderId: string): DomainEvent {
  return { type: "order.placed", payload: { orderId }, at: 0 };
}

export function orderCancelled(orderId: string): DomainEvent {
  return { type: "order.cancelled", payload: { orderId }, at: 0 };
}

export function adminActionTaken(action: string): DomainEvent {
  return { type: "admin.action", payload: { action }, at: 0 };
}

export function reportExported(reportId: string): DomainEvent {
  return { type: "report.exported", payload: { reportId }, at: 0 };
}
