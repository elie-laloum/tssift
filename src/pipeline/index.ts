/**
 * The pipeline. Four properties hold for every stage in this directory, and they
 * are the reason the whole design works:
 *
 *  1. **Pure.** No I/O, no global state, no clock. That is what makes the output
 *     snapshot-testable at all.
 *  2. **No `typescript`, ever.** Everything a stage could need was captured at
 *     ingestion, on `NormalizedDiagnostic.context` and on `ProgramFacts`
 *     (rule 4). A single `import type * as TS` under this directory means the
 *     TS 7 port would force a rewrite instead of an addition. Asserted by
 *     `test/architecture.test.ts`.
 *  3. **Nothing is deleted, only declassed** (rule 2) — with the one bounded
 *     exception argued in `dedupe.ts`, which removes only byte-identical
 *     copies, i.e. removes no information at all.
 *  4. **Nothing is derived on a resemblance** (§5.1). The only link that
 *     attaches one diagnostic to another is an identical declaration site.
 *
 * The order is `dedupe → detectCausality → entriesOf`, and `run.ts` is the only
 * place that composes them.
 */
export type { BudgetedEntry, BudgetResult } from "./budget.js";
export { CHARS_PER_TOKEN, estimateTokens, fitToBudget } from "./budget.js";
export { detectCausality } from "./causality.js";
export { dedupe } from "./dedupe.js";
export type { DiagnosticEntry, Entry, GroupEntry } from "./group.js";
export { entriesOf, MAX_SHOWN_MEMBERS, sizeOf } from "./group.js";
