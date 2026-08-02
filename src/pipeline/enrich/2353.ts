/**
 * TS2353 — `Object literal may only specify known properties, and 'x' does not
 * exist in type 'T'`.
 *
 * The same cause as TS2339 reached through object-literal syntax. The difference
 * that matters here is that `T` is the literal's **contextual** type, so nothing
 * in the source names it: the reader is told about a type they cannot locate by
 * grepping the line. The declaration site is therefore worth more on this code
 * than on any other.
 *
 * The symbol arrives on `context.expected` rather than `context.subject` — that
 * is `sources/context.ts`'s convention for "the type the code was checked
 * against", and it also carries `actual`, the literal's own shape.
 */
import type { Fact, NormalizedDiagnostic } from "../../types.js";
import { factsOfSymbol } from "./facts.js";

export function enrich2353(diagnostic: NormalizedDiagnostic): Fact[] {
  const expected = diagnostic.context?.expected;
  return expected ? factsOfSymbol(expected, "expected type") : [];
}
