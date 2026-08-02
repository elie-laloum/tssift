/**
 * TS2554 — `Expected N arguments, but got M`.
 *
 * The highest ratio of added information to captured bytes in the table. The
 * native message is two numbers: it names neither the callee, nor its signature,
 * nor where that signature lives. Everything a reader needs is on
 * `context.subject`, which `sources/context.ts` fills from
 * `getResolvedSignature().declaration`.
 *
 * This is also the code behind the corpus's largest cascade — 152 diagnostics on
 * one arrow function — so the fact rendered once under a group header stands in
 * for 152 lines of "Expected 2 arguments, but got 3".
 */
import type { Fact, NormalizedDiagnostic } from "../../types.js";
import { factsOfSymbol } from "./facts.js";

export function enrich2554(diagnostic: NormalizedDiagnostic): Fact[] {
  const subject = diagnostic.context?.subject;
  // No member list on a signature: `getPropertiesOfType` of a function type
  // returns its apparent members (`call`, `apply`, …), which is compiler
  // plumbing rather than anything the caller wrote.
  return subject ? factsOfSymbol(subject, "callee").filter((f) => f.kind !== "members") : [];
}
