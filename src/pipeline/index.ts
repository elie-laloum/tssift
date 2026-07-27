/**
 * The pipeline. Three properties hold for every stage in this directory, and
 * they are the reason the whole design works:
 *
 *  1. **Pure.** `(diagnostics, facts) => diagnostics`. No I/O, no global state,
 *     no clock. That is what makes the output snapshot-testable at all.
 *  2. **No `typescript`, ever.** Everything a stage could need was captured at
 *     ingestion, on `NormalizedDiagnostic.context` and on `ProgramFacts`
 *     (rule 4). A single `import type * as TS` under this directory means the
 *     TS 7 port would force a rewrite instead of an addition.
 *  3. **Nothing is deleted, only declassed** (rule 2) — with the one bounded
 *     exception argued in `dedupe.ts`, which removes only byte-identical
 *     copies, i.e. removes no information at all.
 */
export { dedupe } from "./dedupe.js";
