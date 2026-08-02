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
 * | 2724 | 2305 with a suggestion appended (`… Did you mean 'Z'?`). Same resolver, same shape. | 3/3 on `broken-barrel-export` |
 * | 2554 | `Expected N arguments, but got M`. `getResolvedSignature().declaration` is an ordinary structural link, so the corpus's largest cascade folds without amending §5.1. | 152/152 on `lekes-ok-arity-changed` |
 * | 2739 · 2740 · 2741 | `… is missing the following properties from type 'T'` / `Property 'x' is missing … but required in type 'T'`. `T` is the shared declaration: N construction sites of one interface break together the day it gains a required member. Added 2026-08-02. | 6/6 on the two fixtures, 3 per interface |
 *
 * **2739 and 2741 are one failure counted twice, and the pair is captured for
 * the 2305/2724 reason.** TypeScript emits 2741 at exactly one missing property
 * and 2739 from two — so which code fires depends on *how many* members were
 * forgotten, not on what went wrong. Capturing one and not the other would make
 * an identical cascade fold or not depending on whether someone dropped one
 * field or two.
 *
 * **What the same measurement refuted, and it is not a detail: TS2739 never
 * truncates its list.** The blocker recorded on 2026-08-01 — "TypeScript
 * truncates its own list and nothing captures the rest" — is true of a *third*
 * code. Probed on 5.9.3 with 1 to 8 missing properties: 1 ⇒ **2741** (names it),
 * 2 to 5 ⇒ **2739** (complete list, never elided), 6 and beyond ⇒ **2740**
 * (`…, and N more.`, truncated at four). The "complete list of the missing"
 * payload §5.2 attributed to 2739/2741 therefore does not exist for them, and
 * what those two get instead is the declaration site.
 *
 * **2740 was absent from PROJECT.md §5.2 and was added to it deliberately on
 * 2026-08-02**, as the human decision AGENTS.md requires for a code outside the
 * table. It is the only place where that payload is real, and `fixtures/
 * missing-many-properties` is the only fixture that emits it.
 *
 * **2724 was found by the fixture guard, not by design, and the lesson matters.**
 * TypeScript picks 2724 over 2305 whenever the missing name has a near match
 * among the module's real exports — so **which of the two fires is a property of
 * the names involved, not of the failure**. `broken-barrel-export` emits 2724 and
 * never 2305, purely because `Order` sits beside `OrderId`. Had the list stopped
 * at 2305, an identical cascade would have folded or not depending on how the
 * author happened to spell things, and nothing would have said why.
 *
 * **Deliberately absent, and why** — the list is short on purpose:
 *
 * - **2307** (`Cannot find module`) has nothing to resolve: the module did not
 *   resolve, so there is no declaration to point at. Its derivation rule in
 *   §5.1 runs on `ProgramFacts.imports`, which P0 already captures.
 * - **2769 · 2322 · 18047/18048 · 2551** are §5.2 enrichment codes whose payload
 *   is a *fact for a reader*, not a link for causality. 2769's is already in
 *   `chain`, 2551's is already in the message, and the other two have nothing
 *   here to resolve. (2739/2741 were on this list until 2026-08-02, when the
 *   measurement above showed they carry a shared declaration and therefore a
 *   causality link, not merely a fact.)
 *
 * The list this will grow into is PROJECT.md §5.2 — the same table that drives
 * the enrichers, which is why it lives in one declarative place.
 */
export const CONTEXT_CAPTURE_CODES: readonly number[] = [
  2305, 2339, 2345, 2353, 2554, 2724, 2739, 2740, 2741,
];
