/**
 * The root cause of this corpus entry.
 *
 * `emit` used to take just the event: `emit(event: DomainEvent)`. When the
 * audit trail started recording who performed each action, a required second
 * parameter, `actor`, was added. Every call site in this project still passes
 * a single argument, so each one now raises TS2554. Giving `actor` a default
 * here settles all of them at once.
 */

import type { DomainEvent } from "./types";

const sink: DomainEvent[] = [];

export function emit(event: DomainEvent, actor: string): void {
  sink.push({
    ...event,
    payload: { ...event.payload, actor },
  });
}

export function drain(): DomainEvent[] {
  return sink.splice(0, sink.length);
}
