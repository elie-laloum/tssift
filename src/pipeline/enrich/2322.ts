/**
 * TS2322 — `Type 'A' is not assignable to type 'B'`.
 *
 * The last of §5.2's ten to ship, and it shipped for a reason the table did not
 * anticipate. §5.2 asks 2322 for "the divergence path (`a.b[0].c`)", which needs
 * both types as structures and is still not derivable from what is captured.
 * What *is* derivable turned out to matter more: **where `B` is declared, and
 * what `B` actually permits.**
 *
 * `Type '"GBP"' is not assignable to type 'Currency'.` names the type it
 * rejected the value for, and says neither where `Currency` lives nor that it
 * is `"EUR" | "USD"`. Both are one hover away in an editor and unreachable from
 * a terminal, which is this project's whole definition of a fact worth adding.
 *
 * ## Why the shape, and not the property list
 *
 * The opposite of every other enricher here, and the reason is measured. For a
 * named *object* type, `typeToString` returns the name and the property list
 * carries the information (the P2 finding, recorded in `facts.ts`). For a union
 * of *primitives* it inverts: `getPropertiesOfType` answers on the apparent
 * type and hands back the fifty members of `String` — `charAt`, `blink`,
 * `fontcolor` — while the constituents are the entire payload. `hasOwnMembers`
 * in `context.ts` is what keeps that noise out of the capture, so this file can
 * hand the same `factsOfSymbol` both cases and get the right one each time.
 */
import type { Fact, NormalizedDiagnostic } from "../../types.js";
import { factsOfSymbol } from "./facts.js";

export function enrich2322(diagnostic: NormalizedDiagnostic): Fact[] {
  const expected = diagnostic.context?.expected;
  return expected ? factsOfSymbol(expected, "expected type") : [];
}
