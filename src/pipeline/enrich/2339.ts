/**
 * TS2339 — `Property 'x' does not exist on type 'T'`.
 *
 * What TypeScript prints: the property name and the type's *name*. What it never
 * prints, and what an editor gives for free: where `T` is declared, and what `T`
 * actually contains. Both are already on `context.subject`, resolved at
 * ingestion (`src/codes.ts`), so this enricher spends no checker round-trip.
 *
 * **No near match here, and that is a measurement, not an omission.** §5.2 asked
 * for a Levenshtein candidate. Measured 2026-08-01 over the 20 fixtures and the
 * 5 corpus cascades: of 113 TS2339 with a resolved member list, TypeScript
 * itself suggested nothing in 113 cases — it emits TS2551 instead of TS2339 when
 * it finds a candidate, so by construction every TS2339 is a case its own
 * speller rejected. A threshold loose enough to fire anyway fired 38 times, on
 * exactly two distinct names, and was wrong both times: `kind` → `id` and
 * `side` → `id` (distance 2 on a 4-letter name means nothing), both on
 * `shape-tag-renamed` — the one corpus cascade that already resists in B1. A
 * fact naming `id` there points at the wrong declaration, which is the failure
 * rule 1 exists to prevent. See PROJECT.md §5.2 and EVAL.md § P2.
 */
import type { Fact, NormalizedDiagnostic } from "../../types.js";
import { factsOfSymbol } from "./facts.js";

export function enrich2339(diagnostic: NormalizedDiagnostic): Fact[] {
  const subject = diagnostic.context?.subject;
  return subject ? factsOfSymbol(subject, "type") : [];
}
