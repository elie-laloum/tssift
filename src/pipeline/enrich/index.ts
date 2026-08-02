/**
 * Enrichment — the `code → enricher` table of PROJECT.md §5.2.
 *
 * A pipeline stage like any other (rule 4): pure, no I/O, no `typescript`. Every
 * enricher reads `NormalizedDiagnostic.context`, which the *source* filled at
 * ingestion for the codes listed in `src/codes.ts`, and returns `Fact[]`.
 * Nothing here resolves anything; if the context is absent, the diagnostic
 * degrades to its native form, which rule 5 calls a success.
 *
 * ## What the table covers in v1, and why it stops there
 *
 * The rule applied is one line: **an enricher ships when the fact it produces is
 * already captured and TypeScript does not already print it.** Six codes clear
 * it — 2339, 2353, 2345, 2554, 2305 and 2724 — and they are the ones whose
 * payload is a declaration site and a member list, which a terminal reader
 * cannot obtain at all and an editor gives away on hover.
 *
 * The four §5.2 entries that do **not** ship, each for a stated reason rather
 * than for lack of time:
 *
 * - **2769** (`No overload matches this call`) — §5.2 ranks it first, and the
 *   measurement demotes it. Its whole payload is already in `chain`: TypeScript
 *   nests one TS2772 per candidate, each carrying the signature *and* the error
 *   that killed it, and the renderer has printed that tree since P0. What §5.2
 *   asked to add on top — "which one fails latest, and on which argument" — is
 *   not derivable from what is captured: on `overload-mismatch`, the only
 *   fixture with a branching chain, all three branches have identical depth and
 *   one leaf each, so no structural signal separates them. Ranking them would
 *   mean reading the leaf messages semantically, which is guessing (rule 5).
 * **2322 shipped on 2026-08-02, and not for the reason §5.2 gave.** That table
 * asks it for the divergence path (`a.b[0].c`), which needs both types as
 * structures and is still not derivable. What is derivable turned out to be
 * worth more: where the target type is declared, and — for a union — what it
 * actually permits. It also folds: `assignability-mismatch`, the fixture
 * written to *forbid* keying on a `related` span, folds correctly on the
 * contextual type instead.
 * - **18047/18048** (`Possibly null`) — the origin of the nullability is a
 *   control-flow question; nothing captured answers it.
 *
 * **2739/2740/2741 shipped on 2026-08-02, and the measurement corrected §5.2 on
 * the way.** That table asks 2739/2741 for "the exact list of the missing"
 * because TypeScript is said to truncate its own. It does not: 1 missing gives
 * TS2741, 2 to 5 give TS2739 with the list complete, and only **TS2740** elides,
 * at four, from six missing upwards. So the payload §5.2 described belongs to a
 * code that was **not in its table of ten** — added there deliberately, as a
 * human decision, on 2026-08-02. What all three add is the declaration site of
 * the target type, which no message of theirs ever carries; what 2740 alone adds
 * is the members its own sentence counted and declined to name.
 *
 * **2307 shipped on 2026-08-02**, and it is the one enricher that reads no
 * `context`: its facts are about the *installed topology* — declared or not in
 * `package.json`, PnP, `paths` — which is file reading a pipeline stage may not
 * do (rule 4). What unblocked it is the `ProgramFacts.resolution` channel the
 * source now fills; that is the shape every remaining §5.2 entry is waiting for
 * too, each on a different missing channel.
 *
 * And one entry ships as a **deliberate no-op**: **2551** (`Did you mean X`) is
 * already good natively and §5.2's instruction is to not degrade it. It is
 * absent from the table below, so it renders exactly as TypeScript wrote it.
 *
 * ## No suggestions, on any code
 *
 * §5.2 asked for a Levenshtein near match on 2339. It is not implemented, on
 * evidence: TypeScript emits TS2551/TS2724 instead of TS2339/TS2305 whenever its
 * own speller finds a candidate, so every diagnostic reaching an enricher here is
 * one it already rejected. Measured 2026-08-01 over the 20 fixtures and the 5
 * corpus cascades, a threshold loose enough to fire anyway fired 38 times, on two
 * distinct names, and was wrong on both. Detail in `2339.ts` and EVAL.md § P2.
 */
import type {
  DiagnosticReport,
  EnrichedDiagnostic,
  Fact,
  NormalizedDiagnostic,
  ProgramFacts,
} from "../../types.js";
import { enrich2305 } from "./2305.js";
import { enrich2307 } from "./2307.js";
import { enrich2322 } from "./2322.js";
import { enrich2339 } from "./2339.js";
import { enrich2345 } from "./2345.js";
import { enrich2353 } from "./2353.js";
import { enrich2554 } from "./2554.js";
import { enrich2739 } from "./2739.js";

/**
 * Both channels of rule 4 reach an enricher: `NormalizedDiagnostic.context`,
 * captured per diagnostic, and `ProgramFacts`, captured per program. Five of the
 * six enrichers use only the first; 2307 uses only the second, which is what the
 * two-channel design in PROJECT.md §3 was for.
 */
type Enricher = (diagnostic: NormalizedDiagnostic, facts: ProgramFacts) => Fact[];

const ENRICHERS: Record<number, Enricher | undefined> = {
  2305: enrich2305,
  // Same enricher, same shape — see the comment on `2305.ts`.
  2724: enrich2305,
  2307: enrich2307,
  2322: enrich2322,
  2339: enrich2339,
  2345: enrich2345,
  2353: enrich2353,
  2554: enrich2554,
  2739: enrich2739,
  // Same enricher, same failure — see the comment on `2739.ts`.
  2740: enrich2739,
  2741: enrich2739,
};

/** The codes an enricher is registered for. Exported for the architecture test. */
export const ENRICHED_CODES: readonly number[] = Object.keys(ENRICHERS)
  .map(Number)
  .sort((a, b) => a - b);

/**
 * Facts onto every diagnostic the table covers.
 *
 * `confidence` is where "we meant to enrich and could not" becomes visible to a
 * json consumer. A code outside the table renders natively **by design** and
 * stays `high`: nothing was claimed, so nothing is uncertain. A code inside the
 * table whose context did not resolve is the other case — the intent was to add
 * a declaration site and the capture came back empty — and that one is `low`,
 * which rule 5 defines as "render the native format". Measured on the corpus,
 * this is not hypothetical: 8 of 99 TS2339 resolve to no declaration at all,
 * every one downstream of an implicit `any`.
 */
/**
 * Do these facts describe something declared outside the program's own files?
 *
 * The same authority §5.1 gives causality — `ProgramFacts.files`, never a prefix
 * test on the path, so a sibling package in a monorepo is admitted while a lib
 * type is not. Extended to enrichment on 2026-08-02, when capturing TS2322
 * produced the first case: `unconstrained-generic` resolves its expected type to
 * `Map` in `lib.es2015.collection.d.ts`, and the facts that came back were a
 * declaration site nobody will ever open and a list of `Map`'s twelve methods.
 * True, checkable, and worth nothing to the reader of a generic-inference
 * failure.
 *
 * All or nothing, and here that really is right: a diagnostic's facts describe
 * the one symbol its context resolved to, so if the declaration is out of
 * scope, the member list hanging off it is too. Dropping the set makes the
 * diagnostic `confidence: 'low'`, which rule 5 defines as "render the native
 * format" — the honest outcome rather than a fact about the standard library.
 */
function describesOutsideProgram(facts: Fact[], inProgram: ReadonlySet<string>): boolean {
  return facts.some((fact) => fact.span !== undefined && !inProgram.has(fact.span.file));
}

export function enrich(report: DiagnosticReport, facts: ProgramFacts): DiagnosticReport {
  const inProgram = new Set(facts.files);

  const diagnostics = report.diagnostics.map<EnrichedDiagnostic>((diagnostic) => {
    const enricher = ENRICHERS[diagnostic.code];
    if (!enricher) return diagnostic;

    const candidate = enricher(diagnostic, facts);
    const produced = describesOutsideProgram(candidate, inProgram) ? [] : candidate;
    return {
      ...diagnostic,
      facts: produced,
      confidence: produced.length > 0 ? "high" : "low",
    };
  });

  return { diagnostics, groups: report.groups };
}
