/**
 * TS2305 — `Module 'X' has no exported member 'Y'`.
 * TS2724 — the same, with a suggestion appended: `… Did you mean 'Z'?`
 *
 * One enricher for both, for the reason `src/codes.ts` records: which of the two
 * codes fires is a property of the *names* involved, not of the failure.
 * TypeScript picks 2724 whenever the missing name has a near match among the
 * real exports. Splitting them would make an identical cascade enrich or not
 * depending on how the author happened to spell things.
 *
 * What is added: **the module's real export list**, which TypeScript never
 * prints on either code, and the resolved module's location — the specifier in
 * the message is as written, so on a `paths` mapping or a package specifier the
 * reader has no way to tell which file answered.
 *
 * What is deliberately not added: a suggestion. On TS2724 TypeScript already
 * made one and §5.2's standing instruction for suggestions is not to degrade
 * what is already good natively; on TS2305 it looked and found none, so ours
 * would fire exactly where its own speller said no. Measured over the fixtures
 * and the corpus: 24 of 24 with a resolved export list, TypeScript suggested
 * nothing, and a Levenshtein pass at a comparable threshold added nothing on any
 * of them (EVAL.md § P2).
 */
import type { Fact, NormalizedDiagnostic } from "../../types.js";
import { factsOfSymbol } from "./facts.js";

export function enrich2305(diagnostic: NormalizedDiagnostic): Fact[] {
  const subject = diagnostic.context?.subject;
  return subject ? factsOfSymbol(subject, "module") : [];
}
