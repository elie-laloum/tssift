/**
 * TS2345 — `Argument of type 'A' is not assignable to parameter of type 'B'`.
 *
 * The message already prints both type names, and often both shapes inline, so
 * the only thing added here is what it structurally cannot carry: **where the
 * parameter's type is declared**, and its full member list when the message
 * truncated the shape.
 *
 * §5.2 also asked for "the first diverging field". It is not produced, and the
 * reason is a data one rather than a difficulty one: `context.actual` is captured
 * as *text* (§4), not as a `SymbolRef`, so the supplied type has no member list
 * to diff against the expected one. Computing it would mean either parsing a
 * type rendering — guessing, forbidden by rule 5 — or capturing a second
 * `SymbolRef` per TS2345, which is a checker round-trip that `src/codes.ts`
 * requires a measurement to justify. Neither is done on an intention.
 */
import type { Fact, NormalizedDiagnostic } from "../../types.js";
import { factsOfSymbol } from "./facts.js";

export function enrich2345(diagnostic: NormalizedDiagnostic): Fact[] {
  const expected = diagnostic.context?.expected;
  return expected ? factsOfSymbol(expected, "parameter type") : [];
}
