/**
 * The declarative list of diagnostic codes for which a source resolves a
 * `DiagnosticContext` at ingestion.
 *
 * The source knows numbers, never enrichers. This list is the single place that
 * decides what a checker round-trip is spent on — the pipeline never sees the
 * checker (rule 4), so anything absent here is permanently invisible to it.
 *
 * **Every entry is paid for in checker round-trips** (P1 decision 28), so every
 * entry is justified below by a measurement, not by an intention. Measured
 * 2026-07-27 on `.corpus/` under TypeScript 5.9.3; resolution rate is the share
 * of diagnostics of that code that come back with a usable `declaredAt`.
 *
 * | code | why it is here | resolution rate |
 * |------|----------------|-----------------|
 * | 2339 | `Property 'x' does not exist on type 'T'`. The receiver's type is the shared cause. Largest property cascade in the corpus. | 91/99 on `lekes-result-value-renamed`, all on one declaration |
 * | 2353 | Same cause as 2339 through object-literal syntax; the type is *contextual*, so nothing in the source names it. Without it the contract fixture folds nothing. | 1/1 on `partial-interface-rename` |
 * | 2345 | `Argument of type 'A' is not assignable to parameter of type 'B'`. `B` is the shared declaration; `A` is captured as text. | 1/1 on `partial-interface-rename` |
 * | 2305 | `Module 'X' has no exported member 'Y'`. Measured first, as the plan asked: `ProgramFacts.imports` is **not** enough — it carries specifiers as written, so importers of one module through different relative paths look unrelated. | 12/12 on `lekes-task-export-renamed` |
 * | 2554 | `Expected N arguments, but got M`. `getResolvedSignature().declaration` is an ordinary structural link, so the corpus's largest cascade folds without amending §5.1. | 152/152 on `lekes-ok-arity-changed` |
 *
 * **Deliberately absent, and why** — the list is short on purpose:
 *
 * - **2307** (`Cannot find module`) has nothing to resolve: the module did not
 *   resolve, so there is no declaration to point at. Its derivation rule in
 *   §5.1 runs on `ProgramFacts.imports`, which P0 already captures.
 * - **2769 · 2322 · 2739/2741 · 18047/18048 · 2551** are §5.2 enrichment codes.
 *   Their payload is a *fact for a reader*, not a link for causality, and P2 is
 *   where that is spent. Adding them now would buy round-trips no consumer reads.
 *
 * The list this will grow into is PROJECT.md §5.2 — the same table that drives
 * the enrichers, which is why it lives in one declarative place.
 */
export const CONTEXT_CAPTURE_CODES: readonly number[] = [2305, 2339, 2345, 2353, 2554];
