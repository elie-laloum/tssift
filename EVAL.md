# EVAL — measurements

**Last updated:** 2026-08-03 — B2, and the first real-code check of the P2 enrichers
**Stages reported here:** **B0** (deterministic, no model call) · **B1** and **B2** (model arm)
**Reproduction:** `mise exec -- bun run eval` (B0) · `mise exec -- bun run eval:agent` (B1/B2, endpoint in `.env`)

> **This file is in English; the rest of the project documentation is in French.** The
> convention was changed on 2026-08-03, deliberately and for one reason: every number here
> is meant to be reproducible and citable by someone who did not write it, and the renderer
> output quoted throughout is English (rule 13). A French frame around English samples made
> this the one document where the reader had to switch languages mid-table. `PROJECT.md` and
> `AGENTS.md` stay in French — see AGENTS.md § "Conventions de code".

**The rule this file obeys:** report the measurement obtained, not the measurement hoped
for. Several sections below weaken a hypothesis this project is built on. They stay.

---

## Contents

- [What B0 measures, and what it does not](#what-b0-measures-and-what-it-does-not)
- [Baseline — 2026-07-27, P0 (before causality)](#baseline--2026-07-27-p0-before-causality)
- [An honest reading of the baseline](#an-honest-reading-of-the-baseline)
- [Results — 2026-07-27, after P1 (causality + grouping)](#results--2026-07-27-after-p1-causality--grouping)
- [P1 T1 — what selective capture returns, and what it costs](#p1-t1--what-selective-capture-returns-and-what-it-costs)
- [Corpus limits](#corpus-limits)
- [An unplanned witness for rule 15](#an-unplanned-witness-for-rule-15)
- [B1 — the model arm](#b1--the-model-arm)
- [P2 — enrichment: what it adds and what it costs (2026-08-01)](#p2--enrichment-what-it-adds-and-what-it-costs-2026-08-01)
- [P2 / 2307 — the module enricher, and a published number that did not reproduce (2026-08-02)](#p2--2307--the-module-enricher-and-a-published-number-that-did-not-reproduce-2026-08-02)
- [P2 / 2739 · 2741 — the measurement that corrected §5.2 (2026-08-02)](#p2--2739--2741--the-measurement-that-corrected-52-2026-08-02)
- [P2 / 2740 — the code §5.2 described without naming (2026-08-02)](#p2--2740--the-code-52-described-without-naming-2026-08-02)
- [P2 / 2322 — the last enrichable code, and not for the announced reason (2026-08-02)](#p2--2322--the-last-enrichable-code-and-not-for-the-announced-reason-2026-08-02)
- [B2 — the model arm re-measured on enriched output (2026-08-03)](#b2--the-model-arm-re-measured-on-enriched-output-2026-08-03)
- [Real code — `keyzia/data-explorer` (2026-08-03)](#real-code--keyziadata-explorer-2026-08-03)

**Numbers that are known not to reproduce, and where their correction lives:**

| published | where | status |
|---|---|---|
| P2 totals `16 861 → 17 538`, B/A `54 % → 56 %` (2026-08-01) | [P2 volume cost](#the-volume-cost-measured-against-the-p1-baseline) | **do not reproduce** — `rootLabel` bug, corrected 2026-08-02. Deltas remain valid; absolute values and ratios do not. See [P2/2307](#first-the-correction-the-harness-was-measuring-a-product-nobody-ships). |
| B1 false-start rates (2026-07-29) | [B1 corpus results](#results-on-the-frozen-corpus--the-real-test-of-h1-2026-07-29) | **not comparable to B2** — the control arm drifted 6 %. And the `order-book` metric is defective. See [B2 §1](#1-b1-and-b2-do-not-subtract--the-control-arm-moved) and [B2 §3](#3-and-the-false-start-metric-is-wrong-on-order-book). |

---

## What B0 measures, and what it does not

B0 compares two texts, nothing else:

| Arm | Content |
|---|---|
| **A** | raw output of `tsc --noEmit --pretty false`, from **the measured project's own compiler**, run in the project directory |
| **B** | the `agent-text` output of `tssift` on the same project |

Three families of targets: the **fixtures** (the contract, tiny), **live real repositories**
(representative but unstable), and the **corpus** — real code frozen at a pinned commit and
then broken by a one-line mutation, described in `eval/corpus.json`. The corpus is what
carries the signal.

Two metrics: the **number of diagnostics** displayed on each side, and the **number of
characters**. The character is the published primitive — anyone can reproduce it without
trusting our tokenizer, and the A/B **ratio**, which is the actual claim, is nearly
tokenizer-independent anyway.

A token estimate is given as `characters / 4`. **The divisor is 4, it is announced here,
and it is an estimate, not a measurement.**

B0 says **nothing** about H2, nothing about fix rate, nothing about false starts. Those
metrics require a model and arrive in B1/B2.

### Measurement precautions

- Arm A **actually runs the project's own `tsc`** (`node <resolved typescript>/../tsc.js`)
  rather than reimplementing its formatting: the published number is literally the text an
  agent would read, summary line included.
- `--incremental false` and a `--tsBuildInfoFile` in a temp directory: without them, a
  project configured as `incremental` would drop a `.tsbuildinfo` into a real repository
  merely because we measured it.
- For every real repository, `git status --porcelain` is recorded before and after, and a
  discrepancy makes the harness exit 1 **naming** the repository concerned.

---

## Baseline — 2026-07-27, P0 (before causality)

Numbers obtained from two consecutive runs giving an **identical** result, with no working
tree warning.

| target | type | ts | A diags | B diags | A chars | B chars | B/A chars | A ~tok | B ~tok |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| partial-interface-rename | fixture | 5.9.3 | 3 | 3 | 523 | 697 | **133 %** | 131 | 174 |
| two-independent-roots | fixture | 5.9.3 | 2 | 2 | 223 | 319 | **143 %** | 56 | 80 |
| overload-mismatch | fixture | 5.9.3 | 1 | 1 | 571 | 1176 | **206 %** | 143 | 294 |
| lekes | real repo | 5.9.3 | 8 | 8 | 1475 | 1877 | **127 %** | 369 | 469 |
| tccp | real repo | 5.9.3 | 0 | 0 | 0 | 40 | n/a | 0 | 10 |
| keyzia/data-explorer | real repo | — | — | — | — | — | **refused, exit 2** ¹ | — | — |
| nextp/cursor-rules-hooks | real repo | 6.0.3 | — | — | — | — | **refused, exit 2** | — | — |
| corpus/lekes-result-value-renamed | corpus | 5.9.3 | 112 | 112 | 18 548 | 19 102 | **103 %** | 4 637 | 4 776 |
| corpus/lekes-task-export-renamed | corpus | 5.9.3 | 12 | 12 | 1 677 | 1 804 | **108 %** | 419 | 451 |
| corpus/lekes-ok-arity-changed | corpus | 5.9.3 | 153 | 153 | 17 602 | 32 025 | **182 %** | 4 401 | 8 006 |

**Totals over the 8 measured targets: diagnostics A = 283, B = 283. Characters A = 39 144,
B = 55 243, i.e. B/A = 141 %.**

*This is the baseline P1 measures itself against (T7 of the plan).*

¹ **`keyzia/data-explorer` changed status on 2026-07-27, and not through drift: through a
bug fix.** Its root holds a *solution* tsconfig (`"files": []`, `"include": []`,
`"references": [4]`). `tsc -p` typechecked **nothing** there and exited 0; both arms agreed
on `0 diagnostics`, and that `0` was **false** — the monorepo's errors exist, lodged in the
referenced projects. An agent read an imaginary "clean" there, exactly the silent fallback
rule 15 forbids. The target now exits **2**, naming the tsconfig, the counts and the four
referenced paths. Decision and measurement in PROJECT.md §9. *(Confirmed again on
2026-08-03 by targeting a referenced sub-project directly — see
[Real code](#real-code--keyziadata-explorer-2026-08-03).)*

Effect on the totals: one fewer measured target (9 → 8) and **33 fewer characters** on the
B side — arm A was worth 0 characters there, so the B/A ratio stays at **141 %**. The
diagnostic count does not move by one unit.

**Two other discrepancies not to mistake for noise** if the measurement is replayed today.
First, **live** `lekes` has dropped back to `0 / 0`: this is the instability already
documented under [Corpus limits](#corpus-limits), and the very reason for freezing a
corpus. Second, a clean run now prints `0 errors · N files checked` instead of `0 errors` —
the file count travels with the zero to make it verifiable, which adds about twenty
characters to the targets with no diagnostics.

### Real code confirms the fixed-cost hypothesis

The three `corpus/` entries are **real code** (`lekes`, 169 TS files), frozen at a pinned
commit, broken by a one-line mutation. Detail and method: `eval/corpus.json`.

On the two wide single-cause cascades, the overhead **collapses**: **103 %** and **108 %**.
This directly confirms what the fixture trend suggested — most of P0's overhead is **fixed**
(header, code prefixes), so it dilutes as soon as the report grows. On the targets that
resemble the real use case, `agent-text` currently costs **3 to 8 % more** than raw `tsc`,
not 106 %.

**The 182 % exception (`lekes-ok-arity-changed`) is instructive and was verified.** 152 of
its 153 diagnostics carry a `relatedInformation` — *"An argument for 'origin' was not
provided."* pointing at `src/shared/domain/result.ts:15:33` — that `tsc --pretty false` does
**not print at all**. The overhead is therefore, 100 %, added information, repeated 152
times.

And that information is not decorative: **each of those 152 related entries designates the
declaration that is the root cause.** It is a structural link, present in the captured data,
exactly the kind PROJECT.md §5.1 allows exploiting — and it is P1 that will have to decide
whether to derive from it, then fold those 152 lines into one root plus a counter.

⚠️ **Do not quote the total alone.** It is dominated by the largest target, so it moves with
it while saying nothing about the product: during the same session, with a more broken
`lekes`, that same total was 124 %. **The per-target ratios and their trend with size are the
only readable numbers here.**

---

## An honest reading of the baseline

**P0's gain was zero on diagnostics and negative on characters.** Same count on both sides —
**283 against 283** — and output 3 % to 106 % larger depending on the target. *(An earlier
version of this sentence said "14 against 14": that was the total from before the corpus
existed, left in place after the table was redone. Corrected 2026-07-27.)*

This is not underperformance, it is the expected and announced result
(`.plans/2026-07-27_p0-b0.md` § T9, PROJECT.md §6): **in P0 there is neither causality nor
enrichment.** Arm B contains exactly the same diagnostics as arm A, only reformatted and
annotated. Cascade folding — the mechanism that carries H1 — arrives in **P1**, and the
"after P1" table below is what it produced.

### Where the extra characters come from

Verified on `overload-mismatch`, where the gap is widest (571 → 1176 characters). Arm A raw,
in full:

```
src/transport/client.ts(4,10): error TS2769: No overload matches this call.
  Overload 1 of 3, '(url: string, options: GetOptions): string', gave the following error.
    Type '"POST"' is not assignable to type '"GET"'.
  Overload 2 of 3, '(url: string, options: PostOptions): string', gave the following error.
    Type '"exponentail"' is not assignable to type '"exponential" | "linear"'. Did you mean '"exponential"'?
  Overload 3 of 3, '(url: string, options: StreamOptions): string', gave the following error.
    Type '"POST"' is not assignable to type '"STREAM"'.
```

B's 605 extra characters break down into three items, and only one of them is pure
formatting:

1. **~430 characters of `relatedInformation` that `tsc --pretty false` does not print at
   all.** This is the dominant item, and the fact is verified: the output above contains
   none of the three `The expected type comes from property … which is declared here`, nor
   their positions. `tssift` prints them with `file:line:column`. **These are not wasted
   characters: this is information the agent would otherwise have to fetch with a `Read` or a
   `Grep`,** whose cost appears in no column of this table.
2. **~48 characters of `TSxxxx: ` prefixes** on chain nodes. `tsc` indents nodes without ever
   giving their code, while a 2769 chain here ends on a 2820 and that is the code that
   informs.
3. **~45 characters of header** (`root:` plus the summary line), paid once per run, hence
   negligible as soon as a project has several errors.

**The trend with size is the number to remember**: 206 % on a 1-diagnostic fixture, 127 % on
a real 8-diagnostic repository. The overhead is largely fixed; it is the cascade noise, which
P1 attacks, that grows.

### What this table does not say

- **It says nothing about H1.** H1 is about false starts and about tokens *once cascades are
  folded*. No cascade is folded here.
- **It does not count avoided reads.** A positioned `related` potentially replaces a `Read`.
  B0 measures report size, not the total cost of the agent loop. B1 will settle that, and it
  is also what will decide the `--snippets` variant.
- **It only compares text.** The `json` output, the complete report and future MCP payload,
  is larger still and is not measured here.

---

## Results — 2026-07-27, after P1 (causality + grouping)

**This is the H1 number.** Same protocol, same corpus, same day, same TypeScript version as
the baseline above. Only arm B changed: it now goes through `dedupe → detectCausality →
entriesOf` before the renderer.

`B entries` counts report **entries**, not diagnostics. That is precisely the shift P1
claims: after folding, one entry can represent a whole cascade. The total they cover stays
entirely in `json`, and `--all` restores it line by line.

| target | type | ts | A diags | B entries | fold | A chars | B chars | B/A chars | A ~tok | B ~tok |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| partial-interface-rename | fixture | 5.9.3 | 3 | 1 | 67 % | 523 | 831 | 159 % | 131 | 208 |
| **two-independent-roots** | fixture | 5.9.3 | 2 | **2** | **0 %** | 223 | 319 | 143 % | 56 | 80 |
| overload-mismatch | fixture | 5.9.3 | 1 | 1 | 0 % | 571 | 1 176 | 206 % | 143 | 294 |
| broken-barrel-export | fixture | 5.9.3 | 3 | 1 | 67 % | 361 | 568 | 157 % | 90 | 142 |
| arity-changed | fixture | 5.9.3 | 4 | 1 | 75 % | 313 | 725 | **232 %** | 78 | 181 |
| **narrowed-union-member** | fixture | 5.9.3 | 8 | 1 | **88 %** | 1 365 | 804 | **59 %** | 341 | 201 |
| nullable-chain | fixture | 5.9.3 | 4 | **4** | **0 %** | 334 | 429 | 128 % | 84 | 107 |
| missing-required-property | fixture | 5.9.3 | 3 | **3** | **0 %** | 449 | 759 | 169 % | 112 | 190 |
| assignability-mismatch | fixture | 5.9.3 | 3 | **3** | **0 %** | 284 | 640 | 225 % | 71 | 160 |
| misspelled-property | fixture | 5.9.3 | 2 | **2** | **0 %** | 254 | 486 | 191 % | 64 | 122 |
| unconstrained-generic | fixture | 5.9.3 | 4 | **4** | **0 %** | 448 | 562 | 125 % | 112 | 141 |
| value-used-as-type | fixture | 5.9.3 | 4 | **4** | **0 %** | 579 | 678 | 117 % | 145 | 170 |
| wrong-tsconfig-paths | fixture | 5.9.3 | 4 | 2 | **50 %** | 477 | 666 | 140 % | 119 | 167 |
| monorepo-cross-package | fixture | 5.9.3 | 4 | 1 | **75 %** | 416 | 569 | 137 % | 104 | 142 |
| phantom-dependency-pnpm | fixture | 5.9.3 | 3 | 1 | **67 %** | 303 | 481 | 159 % | 76 | 120 |
| yarn-pnp-project | fixture | 5.9.3 | 3 | 1 | **67 %** | 331 | 510 | 154 % | 83 | 128 |
| missing-type-import | fixture | 5.9.3 | 3 | **3** | **0 %** | 430 | 527 | 123 % | 108 | 132 |
| cannot-find-name | fixture | 5.9.3 | 7 | **7** | **0 %** | 493 | 598 | 121 % | 123 | 150 |
| missing-multiple-properties | fixture | 5.9.3 | 3 | **3** | **0 %** | 429 | 533 | 124 % | 107 | 133 |
| **two-roots-one-file** | fixture | 5.9.3 | 4 | **2** | **50 %** | 356 | 654 | 184 % | 89 | 164 |
| corpus/lekes-result-value-renamed | corpus | 5.9.3 | 112 | 22 | **80 %** | 18 548 | 3 742 | **20 %** | 4 637 | 936 |
| corpus/lekes-task-export-renamed | corpus | 5.9.3 | 12 | 1 | **92 %** | 1 677 | 711 | **42 %** | 419 | 178 |
| corpus/lekes-ok-arity-changed | corpus | 5.9.3 | 153 | 2 | **99 %** | 17 602 | 1 061 | **6 %** | 4 401 | 265 |

**Totals over the 25 measured targets: diagnostics A = 349 → entries B = 72 (79 % fold).
Characters A = 46 766, B = 18 149, i.e. B/A = 39 %.**

*The four lines `missing-type-import`, `cannot-find-name`, `missing-multiple-properties` and
`two-roots-one-file` date from 2026-07-28 (T0 of B1). The three 2307 lines —
`wrong-tsconfig-paths`, `phantom-dependency-pnpm`, `yarn-pnp-project` — were **re-measured the
same day after T1**: they now fold (78 → 72 entries). A fact not to misread: their character
`B/A` **rises** (121–133 % → 140–159 %) even as they fold. This is the same effect as
`partial-interface-rename` — below the three-site display cap every diagnostic still prints,
and the cause header (`cause: unresolved module 'qs'` plus the count line) is added on top.
**T1's gain there is structural — the reader learns the failure is ONE missing module, not
three — not volumetric.** The total therefore goes from 38 % to 39 % by folding, for exactly
that reason.*

### The number twenty fixtures make it possible to give: **8 out of 17** (5 before T1)

Twenty fixtures, of which three are not single-cause cascades: `overload-mismatch` has only
one diagnostic, and there are **two multi-root negative controls** — `two-independent-roots`
(two causes, two files, two codes) and `two-roots-one-file` (two causes, one file, one code).
That leaves **seventeen single-cause cascades**. Before T1 the threshold folded five; **the
2307 rule (T1, 2026-07-28) adds three**, bringing the count to **eight**:

| folds | does not fold |
|---|---|
| `partial-interface-rename` (3 → 1) · `broken-barrel-export` (3 → 1) · `arity-changed` (4 → 1) · `narrowed-union-member` (8 → 1) · `monorepo-cross-package` (4 → 1) · **`wrong-tsconfig-paths` (4 → 2)** · **`phantom-dependency-pnpm` (3 → 1)** · **`yarn-pnp-project` (3 → 1)** | `nullable-chain` (18047) · `missing-required-property` (2741) · `missing-multiple-properties` (2739) · `assignability-mismatch` (2322) · `misspelled-property` (2551) · `unconstrained-generic` (2536) · `value-used-as-type` (2749) · `missing-type-import` (1484) · `cannot-find-name` (2304) |

`wrong-tsconfig-paths` folds **4 → 2** and not 4 → 1: its two specifiers (`@domain/order` ×3,
`@domain/customer` ×1) are two distinct modules, and the second, alone, stays below the
two-member minimum. Grouping two aliases under one header would be the over-grouping §11
classifies as critical — so the rule emits two entries, by design.

**This is the most useful measurement produced since the H1 number.** Until T1 it said that
folding did not rest on a general property of cascades but on **the six-code list in
`src/codes.ts`**; T1 qualified that. **2307 folds without being in that list** — it needs no
capture code, it works on `ProgramFacts.imports` and the verbatim message. Folding therefore
rests on two mechanisms: an identical `declaredAt` (the first five) and a shared unresolved
specifier (the three 2307). Outside those two links, a perfectly real cascade is still
rendered flat, and the nine non-folds come out between **117 % and 225 %**, P0's overhead.

**The ratio rose then fell back depending on what came in — 4/10, 5/14, 5/17 (T0), then 8/17
(T1) — and none of that is a regression.** T0 added cascades of uncaptured codes
(`missing-type-import` TS1484, `cannot-find-name` TS2304, `missing-multiple-properties`
TS2739) plus the `two-roots-one-file` negative control; the ratio therefore fell. T1, the same
day, wrote the 2307 rule and made the three fixtures that unblocked it fold:
`wrong-tsconfig-paths` (4 → 2), `phantom-dependency-pnpm` and `yarn-pnp-project` (3 → 1). The
five `declaredAt` folds are unchanged to the character.

Note that this is not a design ceiling:

- 18047 · 2741 · 2739 · 2322 · 2551 are in the §5.2 table of ten and await the numbers (rule
  8); 2749 and 1484 are outside the table (native format assumed), and 2304 is the second half
  of the §5.1 root list, the unwritten sister of the 2307 rule;
- **2307 is now an acquired fold, not a gap.** Its derivation rule (T1) works only on
  `ProgramFacts.imports` and the message, with no context capture; it was not deferred for
  lack of data but for lack of a fixture, and that gap was filled in the preceding T0. Detail
  below.

### `assignability-mismatch` settles design question 2 — and the answer is no

The P1 plan's question: **can a `related` span serve as a grouping key?** It had been
classified *moot*, then reopened by `missing-required-property`, whose three diagnostics all
print a `related` designating exactly their common cause. This fixture closes it again, in
the other direction, by construction rather than by argument.

Its cause is `type Currency = "EUR" | "USD"` at `src/pricing/currency.ts:6` — the union lost
`"GBP"`. However:

- **two** of its three diagnostics carry a `related`, and it points at `currency.ts:9:3` — the
  `currency` **property** of `Rate`. That line is **correct code**, which the reader must not
  touch;
- the **third** — a direct annotation, `const reportingCurrency: Currency = "GBP"` — carries
  **no** `related` at all.

A rule indexed on the `related` would therefore group two diagnostics out of three, **headed
by a declaration that does not need changing**, and leave the third outside. Sending the
reader to the wrong line is the failure mode §11 classifies as critical; it is simply more
discreet than merging two independent bugs. **A `related` points where the compiler judged it
useful to explain *that* diagnostic, which is not the same thing as the cause.**

The two fixtures therefore read together: `missing-required-property` shows a link that is
present and correct, `assignability-mismatch` a link that is present and misleading. The rule
is not merely unproven, it is **wrong**. A named test guards it (`test/causality.test.ts`).

### `value-used-as-type` marks the outer edge of the threshold

Four diagnostics, one cause, and **nothing to capture**: no `related`, no resolvable
declaration. `OrderStatus` really does exist — it is a `const` object — it simply makes no
sense in type position. The compiler therefore has no structural link to offer. Any rule
folding this cascade would have to work on the identifier and `ProgramFacts.imports`, that is,
derive on "the same name" — precisely what §5.1 forbids. This is not a capture gap, it is the
limit of what the structural threshold can reach, and it is useful to have committed it.

### The 2307 rule, written in T1 — what the three fixtures forced on it

§5.1 left the 2307 rule — "everything importing the unresolved module is derived" — unwritten.
**It has existed since T1 (2026-07-28)**, and it folds TS2307 by specifier:
`phantom-dependency-pnpm` and `yarn-pnp-project` 3 → 1, `wrong-tsconfig-paths` 4 → 2, the
lone 2307 of `two-independent-roots` unchanged. Three things those fixtures forced on its
shape, that no dry reasoning had produced:

1. **The cascade is *of* 2307, not *from* a 2307.** An unresolved import gives `any` to the
   imported bindings and emits nothing further downstream: on all three fixtures, **every**
   diagnostic is a 2307. The rule therefore folds 2307s among themselves — it does not harvest
   "errors in the files that import", there are none.
2. **The key is the specifier, never the file.** `src/api-client.ts` in
   `phantom-dependency-pnpm` imports `@acme/http`, which resolves, **and** `qs`, which does
   not. `imports[file]` alone does not say which one failed; the **verbatim message** names the
   failing specifier (`Cannot find module 'qs' …`), and that name, cross-checked against
   `imports[file]`, gives the key. That cross-check is the correctness guard: anything the
   import table does not confirm — a derived template, a relative specifier, an untraversed
   form — stays an isolated root, never a merge.
3. **Grouping all of a project's 2307 would be over-grouping.** `wrong-tsconfig-paths` carries
   three on `@domain/order` and one on `@domain/customer` — a single upstream cause, the
   `paths` line, but it is in **no file of the program**, so nothing in the data names it. The
   rule emits **two entries**, one per specifier, and not one.

Point 3 is the most interesting of the three: `wrong-tsconfig-paths` is the fixture whose root
cause is not in the program at all. No `declaredAt` can designate it, by construction — a
module that does not resolve has no declaration — hence a header of a new kind, `cause:
unresolved module '<spec>'`, without "declared at". This is a different edge of the threshold
from `value-used-as-type`: there, there was no link to capture; here, the link is the specifier
itself.

### `monorepo-cross-package` exercises the guard rather than repeating it

Guard 1 of §5.1 refuses as a cause any declaration outside the program's files —
`<ts-lib>/…`, `node_modules/…` — and it was born from a corpus TS2345 that resolved to
`interface Map`. Until now every folding fixture had its cause in the same package, so the
guard was never put under tension. This one has its four diagnostics in `packages/api` and
`packages/web`, and its cause in `packages/core`: a sibling package is neither `<ts-lib>/…`
nor `node_modules/…`, so the guard must **admit**, and it does. `ProgramFacts.files` is the
authority, not a prefix test — that is the choice being verified here.

Incidentally, this is the first fixture to exceed the three-site cap while folding: four
diagnostics, three displayed, `+1 more site`.

### `yarn-pnp-project` is the only fixture whose `before/` contains no bug

The code there is correct, `@acme/http` is declared in `package.json`, locked in `yarn.lock`,
present on disk under `.yarn/unplugged/`, and referenced by `.pnp.cjs`. The three TS2307 say
nothing about the project: they say the compiler was launched as a bare Node process, without
loading PnP's resolution map. Every other fixture is broken code; this one is correct code,
misread.

**Consequence for tssift itself, to be written in the README rather than discovered in an
issue: tssift is a bare Node process.** Under a PnP project it would produce exactly this
output — three plausible and entirely false errors — if it were not launched through the
runtime (`yarn tssift`). This is the costliest imaginable failure mode for a tool whose
argument is "trust the ranking": nothing is flagged, the output looks normal.

**Settled and implemented in T2 (2026-07-28): the CLI refuses.** `run.ts` detects a `.pnp.cjs`
at the project root **without** `process.versions.pnp` **and** at least one TS2307 rendered, and
exits **2** with a message naming the manifest found and the remedy (`yarn tssift`). The triple
guard avoids refusing a healthy PnP project launched outside the runtime but with no resolution
error. The guard lives in the **CLI layer**, not in the source: the library and the eval keep
folding `yarn-pnp-project` 3 → 1 (which is what makes the fold measurable above), only the CLI
refuses. Pure predicate `isPnpMisread`, tested.

### The four T0 fixtures — the last §7 category, and the hard negative control

The fourth batch brings the corpus to twenty and **closes the §7 category list**. None of the
four folds, and for three of them that is the intended behaviour.

- **`missing-type-import` (TS1484)** covers the last §7 category without a witness, "missing
  type import". `verbatimModuleSyntax` is on and two files import types with a value import:
  three TS1484, with the module resolving perfectly — so it is not a TS2307, the fix is a
  keyword and not a dependency. It is the complement of `value-used-as-type` (a value in type
  position, 2749): here a type in value position. Outside the table of ten, it renders in
  native format, and it incidentally witnesses that three diagnostics of the same code across
  two files stay three isolated roots for want of a derivation link.
- **`cannot-find-name` (TS2304)** is the first fixture to produce 2304, which §5.1 classifies
  as a **near-certain root** on the same footing as 2307 and which no fixture exercised — the
  threshold had only ever seen half of its own root list. Seven references to a single missing
  name in one file: a genuine single-cause cascade whose structure mirrors 2307's (the name
  gives an error at each use, nothing cascades beyond). It does not fold — 2304 is neither
  captured nor derived — so it quantifies the gap a future rule indexed on the missing name
  would fill, sister to the unwritten 2307 rule. *(That rule is designed on 2026-08-03, driven
  by real code — see [Real code](#real-code--keyziadata-explorer-2026-08-03).)*
- **`missing-multiple-properties` (TS2739)** is the multi-member twin of
  `missing-required-property` (2741): three construction sites, two required members missing
  instead of one, all pointing at the declaration of `Rect`. Like its twin it does not fold —
  neither 2739 nor 2741 is captured — and it finally gives 2739 a witness, present in the table
  of ten without a fixture until now.
- **`two-roots-one-file` (TS2339)** is the hard negative control, sister to
  `two-independent-roots`. Where that one separates two causes in two files under two codes,
  this one puts **two causes in one file under a single code** — the case where over-grouping
  is most tempting and, per §11, most destructive. Rule 3 of §5.1 ("same 2339 in the same file
  ⇒ one root") is deliberately **not** applied, and this is where that is verified: each
  interface is misread twice, so a rule indexed on file + code would fold all four under one
  header and hide one of the two bugs behind a counter. The engine indexes on `declaredAt` and
  renders `4 errors · 1 file · 2 root causes` — the two `Widget` ones folded, the two `Gauge`
  ones folded, the two causes held apart. Unlike `two-independent-roots`, this fixture **folds**
  on each side (4 → 2), and that is precisely the point: the separation survives even when
  folding is active on both roots. A named test guards it.

**The total degrades with every small fixture added, and that is not a product regression.**
20 % at three fixtures, 22 % at four, 27 % at eight, 31 % at twelve, 35 % at sixteen, 38 % at
twenty (T0), 39 % after T1: every small fixture enters with a ratio above 100 % and pulls the
average up, and T1's 2307 fold even adds a little — on a tiny target, folding adds a header
without removing anything (every line fits under the cap). **At constant scope the published
numbers are unchanged to the character** — removing the thirteen lines added after the fact
gives back exactly 283 → 29, 39 144 against 7 960, i.e. 20 %. This is why §7 publishes a
per-target ratio: **this total mostly measures the composition of the list.**

### What the folding fixtures taught

**1. A small fixture can go under 100 %, and `narrowed-union-member` is the first: 59 %.**
Eight diagnostics for one entry. What changes compared to the other small targets is that its
diagnostics are **verbose** — each carries a chain node naming the offending union member — so
the three-site cap really does remove volume. Folding pays as soon as the unit diagnostic is
large, not only when the cascade is long.

**2. `arity-changed` comes out at 232 %, the worst ratio in the table — and it is the same code
as the best line in the table.** TS2554 gives **6 %** on `corpus/lekes-ok-arity-changed` (153
diagnostics) and **232 %** here (4 diagnostics). Same family, same causality rule, same
renderer; only cascade size differs. The cause of the overhead is identical in both cases — the
`relatedInformation` that `tsc --pretty false` does not print at all, repeated three times here
for 313 characters of arm A — but at 4 sites folding removes only one, while at 153 it removes
150. **This is H1 stated as a single comparison: the gain is not in the format, it is in the
number of sites one cause explains.**

**3. Two fixtures do not fold at all, and that is their reason for existing.** `nullable-chain`
(4 × TS18047) and `missing-required-property` (3 × TS2741) are single-cause cascades a human
groups at a glance; the §5.1 threshold leaves them as isolated roots, because neither 18047 nor
2741 is in `CONTEXT_CAPTURE_CODES`. Both codes are in the §5.2 table of ten, so this is a known
gap awaiting numbers (rule 8), not an oversight. They are committed precisely so that the gap is
**measurable** rather than anecdotal: 128 % and 169 % are the going price of what the threshold
refuses.

**4. `missing-required-property` reopened a closed question.** Its three diagnostics **already
print their common cause**: each carries a `related` reading `src/accounts/profile.ts:10:3:
'locale' is declared here.` The report therefore names the same shared declaration three times
and still refuses to group on it. This is design question 2 of the P1 plan — *does a `related`
span count as a `declaredAt`?* — classified **moot** because TS2554 had ultimately resolved via
`getResolvedSignature()`. Here it had an object. **`assignability-mismatch` has since closed it
again, in the negative** — see the section above.

Compared to the P0 baseline — **283 / 283, 141 %** — the character ratio is divided by **six to
seven** depending on scope.

### What this table says, and what it does not

**It says H1 holds on real code.** On the three corpus entries, the only targets resembling the
real use case, the ratio goes from 103–182 % to **6–42 %**. `lekes-ok-arity-changed` is the
textbook case: 153 diagnostics spread over 31 files become 2 entries, one of which names
`src/shared/domain/result.ts:15:19` — the line to read — plus a counter for the remaining 149
sites.

**It also says folding returns nothing on a small project *whose diagnostics are short*.**
`partial-interface-rename` goes from 133 % to **159 %**, and `broken-barrel-export` comes out at
**157 %**: their three diagnostics fit under the three-site cap, so all of them still print, and
the cause header is added on top. The gain there is structural — the reader learns *where* the
cause is — not volumetric. On a three-error project, `tsc` has no noise problem anyway.

*The italicised restriction was added on 2026-07-28: the previous version said "on a small
project", unconditionally, and `narrowed-union-member` contradicts it at **59 %** with its eight
diagnostics over three files. It is not project size that decides, it is the product "number of
sites × verbosity of the unit diagnostic". Detail in the section above.*

The `broken-barrel-export` case is the sharper of the two, because folding there is **exactly**
what the fixture exists to show: three different files import the same symbol from a barrel,
`tsc` reports them as three unrelated failures, and `tssift` names `src/domain/index.ts:1:1`
once. 157 % of characters for one entry instead of three, on a project where folding
mechanically has nothing to save.

**The negative control holds: `two-independent-roots` stays at 2 entries for 2 diagnostics, 0 %
fold.** This is the most important measurement in the table after the three corpus entries. Two
unrelated failures stay two failures, and the Definition of Done criterion (§12) is verified by
a named test, not merely observed here.

**It still says nothing about H2**, nor about fix rate, nor about false starts. Those metrics
require a model and arrive in B1/B2. What B0 measures here is a volume and a count, not a
behaviour.

**Under-grouping is visible and deliberate.** `lekes-result-value-renamed` folds 80 %, not 99 %:
21 of its 112 diagnostics stay isolated — 10 TS7006 (implicit `any` parameter, no declaration to
aim at), 8 TS2339 whose receiver is `{}` or `unknown`, 2 TS2353 and 1 TS2345. None carries a
structural link to the cause. Grouping them would require deriving on a resemblance, which §5.1
forbids. This is the intended behaviour.

---

## P1 T1 — what selective capture returns, and what it costs

**Measured 2026-07-27** under TypeScript 5.9.3, reproducible with `mise exec -- bun run
capture:measure`. Decision 28 of the P1 plan: any extension of `CONTEXT_CAPTURE_CODES` is paid
for in checker round-trips, so it is measured before being kept. Captured codes: **2305 · 2339 ·
2345 · 2353 · 2554 · 2724**, justified one by one in `src/codes.ts`.

**2724 arrived last, via T6, and it was not planned.** The `broken-barrel-export` fixture was
meant to produce 2305; it produces 2724 (`… Did you mean 'Order'?`) because TypeScript prefers
the "suggestion" variant as soon as a close name exists among the module's real exports. **The
code emitted therefore depends on the names present, not on the nature of the failure** — an
identical cascade would have folded or not depending on the spelling the author chose. The table
below shows it: 2305 and 2724 resolve to the same place, through the same resolver.

The resolution rate is the share of that code's diagnostics that come back with a usable
`declaredAt`.

| target | code | resolved | where the `declaredAt` points |
|---|---|---:|---|
| partial-interface-rename | 2353 · 2339 · 2345 | 3/3 (100 %) | **one and the same position**, `src/types/user.ts:7:1` |
| two-independent-roots | 2339 | 1/1 | `src/billing/invoice.ts:3:1` — and the 2307 has **no** context |
| broken-barrel-export | 2724 | 3/3 (**100 %**) | 3 on `src/domain/index.ts:1:1`, the barrel — not `order.ts`, which still exports |
| corpus/lekes-result-value-renamed | 2339 | 91/99 (**92 %**) | 91 on `src/shared/domain/result.ts:12:4` |
| corpus/lekes-task-export-renamed | 2305 | 12/12 (**100 %**) | 12 on `…/domain/task.entity.ts:1:1` |
| corpus/lekes-ok-arity-changed | 2554 | 152/152 (**100 %**) | 152 on `src/shared/domain/result.ts:15:19` |

**This is H1's seam, seen for the first time as a structural link** rather than an intuition: 152
diagnostics on one declaration, 91 on another, 12 on a third. Nothing is folded yet — T3 and T4
will do that — but the material for folding exists and is verifiable.

### The time cost is in the noise

Best of 3 runs, capture disabled then enabled:

| target | off | on | delta |
|---|---:|---:|---:|
| partial-interface-rename | 180 ms | 167 ms | −7 % |
| two-independent-roots | 157 ms | 152 ms | −3 % |
| overload-mismatch | 175 ms | 183 ms | **+5 %** |
| broken-barrel-export | 182 ms | 176 ms | −4 % |
| corpus/lekes-result-value-renamed | 3 947 ms | 3 738 ms | −5 % |
| corpus/lekes-task-export-renamed | 4 426 ms | 4 006 ms | −10 % |
| corpus/lekes-ok-arity-changed | 3 781 ms | 4 342 ms | **+15 %** |

*Table replayed on 2026-07-27 at the end of T6, with 2724 in the list. The values move by several
points from one run to the next — `overload-mismatch` was at −3 % on the first pass and comes out
at +5 % here, without a single one of its diagnostics being captured, hence without a single line
of capture code executing on it. This is the best available demonstration that these numbers
measure the machine as much as the tool.*

The negative deltas prove the measurement is dominated by variance: capture cannot *speed up*
loading. `createProgram` and `getPreEmitDiagnostics` cost four seconds on 169 files; the per-
diagnostic tree descent and type resolution get lost inside that. **Below the ~20 % threshold of
decision 28, so lazy capture need not be discussed — but the worst case,
`lekes-ok-arity-changed` with its 152 signature resolutions, rose to +15 % on this second run and
is no longer "well below".** That is the target to re-measure if one more code enters the list.

### The volume cost is real

| target | json off | json on | delta |
|---|---:|---:|---:|
| partial-interface-rename | 2 767 | 5 205 | +88 % |
| two-independent-roots | 1 711 | 2 217 | +30 % |
| broken-barrel-export | 2 646 | 4 893 | +85 % |
| corpus/lekes-result-value-renamed | 104 154 | 160 225 | +54 % |
| corpus/lekes-task-export-renamed | 44 437 | 52 536 | +18 % |
| corpus/lekes-ok-arity-changed | 183 926 | 276 037 | +50 % |
| overload-mismatch | 3 378 | 3 378 | 0 % |

*Both columns have grown since the first measurement (`partial-interface-rename`: 2 410 → 2 767
on the "off" side) because the `json` report now carries `groups`, `role` and `derivedFrom`. The
"on" side therefore also includes the groups capture makes possible — that is honest accounting:
without captured context no group exists, so their bytes are part of what capture costs.*

`memberNames`, `signature` and the `declaredAt` `snippet` are repeated once per diagnostic. **This
is `json` only — `agent-text` is unchanged, so the B0 baseline above does not move by a
character.**

**And the gap did not turn negative after T4, contrary to what this section was betting.** Folding
shows up in `agent-text`, where it takes the report from 141 % to 20 %; `json` stays the complete
report by construction (rule 14) and folds nothing — it *adds* the group index on top of the full
table. The bet was badly framed: there is no contradiction to fix, only two formats doing two
jobs. If `json` volume becomes a problem for MCP, what will be needed is report deduplication,
never removing capture.

### A warning for T3, out of the measurement

On `corpus/lekes-result-value-renamed`, the single TS2345 resolves its `expected` to
**`<ts-lib>/lib.es2015.collection.d.ts:19:1 (interface Map)`**.

That is correct as capture, and it would be a **disaster as a causality criterion**: two
perfectly independent bugs each passing a bad argument to a `Map` method would share that
`declaredAt` and be grouped. This is exactly the over-grouping §11 classifies as *critical*.

Consequence to hold for T3: **a declaration outside the program's files — `<ts-lib>/…`,
`node_modules/…` — cannot serve as a root cause.** The capture stays, because it is true and a
P2 enricher will want it; it is derivation that must refuse it.

Second observation of the same family: on this entry, the 2339s point at the *type literal*
(`result.ts:12:4`) and the 2353 points at the *alias* (`result.ts:11:1`). Two distinct positions,
hence two groups where a human would see one. That is **under-grouping**, the asymmetry §5.1
explicitly accepts: we loosen with numbers, we do not tighten after a miss.

---

## Corpus limits

*Section title updated 2026-08-03: it used to read "to fix before B1". B1 ran; problem 2 was
solved by `eval/corpus.json`, problems 1 and 3 remain open, and [B2 §5](#5-what-to-do-before-replaying)
puts corpus width back at the top of the list.*

Three problems, all observed on the very day of the first measurement. None invalidates the
baseline; all three make the live real-repository corpus unusable as it stands for B1.

**1. `lekes` is a live working tree.** Measured three times in one hour, it gave **23, then 29,
then 8 diagnostics** (6 668, 8 141, then 1 475 characters in arm A). Something modifies it
continuously. The `git status` guard did flag a before/after discrepancy on one of the runs;
on inspection, **our measurement wrote nothing** — no file in any of the three repositories was
modified, and an isolated run leaves the tree unchanged. This is concurrent outside editing.

Two consequences. First, a repository under active work **is not a measurement target**: its
absolute numbers are a snapshot of a moving object. Second, the guard cannot distinguish "we
wrote" from "someone else wrote while we were reading" — it now says so explicitly in its
message rather than letting the reader conclude the worst.

A measurable consolation: across those three very different states, the B/A **ratio** stayed in a
narrow band — 114 %, 113 %, 127 % — while the absolute values varied by a factor of 5. That is
exactly the argument for which §7 publishes a ratio and not a value.

**2. Live real repositories are clean — RESOLVED 2026-07-27 by `eval/corpus.json`.** `tccp` and
`keyzia/data-explorer` have zero diagnostics, and `lekes` oscillates around zero. Valid
measurement points but **without information**.

The obvious lead — "take snapshots of repositories at moments when they were broken" — **does not
work**, and that is a result in itself. Scan of 2026-07-27: **14/14 `lekes` commits and 24 of 240
sampled `data-explorer` commits compile cleanly.** People commit green; CI sees to it. **Broken
states live in working trees, not in history** — and a working tree moves under the measurement
(problem 1).

Hence the chosen solution: **pinned commit + authored mutation**. Each `eval/corpus.json` entry is
a real `sha` plus a one-line `find`/`replace`, materialised by `bun run corpus:build` into
`.corpus/` via `git archive` — without ever touching the source tree. Three properties no other
option had together:

- **frozen** — a `sha` does not move, so the numbers are comparable from month to month;
- **open source** — the public repository contains only references and mutations, never `lekes`'s
  private code; `.corpus/` is git-ignored;
- **ground truth** — we know **by construction** which file is the cause. That is precisely what
  B1's false-start metric requires, and what a randomly found broken commit does not provide.

The corpus produces today **277 diagnostics over 3 root causes**, in three distinct code families
(TS2339, TS2305, TS2554). The script's guard rejects an anchor that is absent, ambiguous, or that
ultimately breaks nothing.

Two traps hit while building it, both encoded in the script:
- an anchor must target a file **tracked at the pinned `sha`** — `git archive` ignores untracked
  files, and `lekes`'s tree contains several;
- a mutation can apply without breaking anything. Removing an export from the `features/agents`
  barrel produced **no** diagnostic: its 11 importers each consume a different symbol. That entry
  was removed rather than dressed up; the barrel case stays covered by the `broken-barrel-export`
  fixture, the fourth one planned.

**3. Version coverage is narrower than announced.** `.plans/2026-07-27_p0-b0.md` gave `lekes` as
TS 5.7 and `tccp` as TS 5.5; both are in fact on **5.9.3** as of 2026-07-27. Both stay in range,
but in practice the measurement only covers **5.9.3 and 5.8.3**. The CI matrix remains the only
place where 5.4 → 5.7 is exercised.

---

## An unplanned witness for rule 15

`nextp/dev-tools/cursor-rules/hooks` carries **TypeScript 6.0.3**. It was not in the protocol, and
it performs on real code the service the CI guard job is meant to perform in the lab: `tssift`
**exits 2** there with a message naming the resolved version, its path and the supported range. No
degraded mode, no stderr warning followed by a wobbly run.

This is the first out-of-lab confirmation that the refusal works, and it is worth noting: a TS 6
repository was already lying around on the development machine before the first line of the
project was written. The PROJECT.md §3 constraint is not a theoretical precaution.

*(Since 2026-08-02 the range is 5.4 → 6.x and this repository would now be accepted; the witness
is kept because what it demonstrates — a refusal that names what it looked for and where — is
unchanged, and TS 7 still exits 2.)*

---

## B1 — the model arm

**Stage B1, distinct from B0.** B0 (everything above) compares two texts only and calls no model.
B1 puts a real agent in the loop and measures its **behaviour** — that is where H1 gets tested on
something other than a character count.

### Protocol (reproducible from this section alone)

In-house harness under `eval/agent/` (`mise exec -- bun run eval:agent`), **with no runtime
dependency**: a tool-use loop on Node 20's global `fetch` against an **OpenAI-compatible** endpoint
(`POST <base>/chat/completions`), no SDK. The `system` prompt is the first message, tools are
`{type:"function", …}`, and the model replies with `tool_calls`. Per target, two arms differing
**only** in the initial framing of the diagnostics:

- **A** = raw output of `tsc --noEmit --pretty false`.
- **B** = the output of tssift's **real CLI** (`run()`), in `agent-text` — so B also reflects the
  PnP guard's refusals (T2): on `yarn-pnp-project`, arm B receives the "Yarn PnP" exit-2 message,
  not a report.

Same fixed **system prompt**, same **three tools that we implement** (`read_file`, `write_file`,
`run_typecheck`, confined to a disposable copy of `before/`), same turn cap (**12**), `temperature:
0` (reproducible run to run), **n = 5**. Model and endpoint are **environment-driven** —
`OPENAI_BASE_URL` (default `https://api.openai.com/v1`), `OPENAI_API_KEY`, `AGENT_MODEL` — so the
same harness drives an OpenAI host, a compatible provider, or a local server without changing a
line. The exact model used is **recorded here with the numbers**. Target set: the **20 fixtures**
plus the **3 corpus entries** = 23 targets × 2 arms × 5 = **230 runs**.

### The four metrics, and where they come from

| metric | what it tests | source in the harness |
|---|---|---|
| first-attempt fix | H2 | final `run_typecheck` at 0 diagnostics |
| turns to green | H1 + H2 | loop counter |
| **false-start rate** | **H1, the core** | a `write_file` **outside** the allowed root set, intercepted at the call |
| regressions | guard | run unresolved after editing |

**The false start is the load-bearing metric**, and it requires machine-readable ground truth:
`rootCauseFiles` was added to each `meta.json` (T4-prep) — the set of paths a valid fix (in the
sense of `expectedFix`) may touch. Writing outside that set is a false start. `yarn-pnp-project`
carries `rootCauseFiles: []`: its `before/` has no bug, so **any** write there is a false start.

> ⚠️ **This metric is defective on `order-book-field-renamed`, discovered in B2.** See
> [B2 §3](#3-and-the-false-start-metric-is-wrong-on-order-book). Two of the five corpus targets
> measure nothing as a result. The B1 numbers below are published as obtained, with that caveat
> attached.

### Results — 2026-07-28, `cx/gpt-5.6-terra` (n=5, 230 runs)

**First real sweep.** Model `cx/gpt-5.6-terra` via a self-hosted OpenAI-compatible gateway,
`temperature: 0`, cap 12 turns, n=5, the 20 fixtures plus 3 corpus entries. The raw table is at the
end of the section; what matters is the reading, and it is **not flattering** — which is a
deliverable, not a failure.

**H2 — first-attempt fix: no signal.** All 230 runs finish green, **100 % on both sides, on every
target.** This model solves every fixture whatever the framing; the metric therefore discriminates
nothing here. That is a fact about *this* model and *these* tasks (small, a single local cause) —
not a refutation of H2, but an absence of purchase: harder tasks, or a weaker model, would be
needed for "reaching green" to separate the two arms.

**H1, tokens — holds on real code, as in B0.** On the **three corpus entries**, the only realistic
targets, arm B consumes **34 % fewer tokens in total** (95 613 against 144 601):
`lekes-ok-arity-changed` **33 089 → 11 191** (the 153 → 2 fold of the initial framing is paid for in
context re-emitted every turn), `result-value-renamed` 42 403 → 30 770, `task-export-renamed`
69 109 → 53 652. On the small fixtures it is mixed, exactly like B0's character ratio: the gain is
volumetric when the cascade is large, nil or negative when it is short.

**H1, false starts — the core, and it does not validate.** Over 115 runs per arm: **arm A 16 false
starts, arm B 19** — the structured report did *not* reduce false starts, it produced slightly more.
They concentrate in one precise family:

- **unresolved module** (`phantom-dependency-pnpm`, `two-independent-roots`, `yarn-pnp-project`):
  ~100 % on both sides. Faced with `Cannot find module 'qs'`, the model reaches green by **writing a
  `src/qs.d.ts`** declaring the module — a workaround that compiles but never touches the real cause
  (`package.json`, the import, the missing dependency). Neither tssift's report nor even **the PnP
  exit-2 refusal** deters it: on `yarn-pnp-project`, where arm B is given *only* the "run through
  yarn" message, the agent stubs anyway and declares the project "green" — hence **false, on a
  project with no bug**. The T2 guard protects a human reader; a determined agent walks past it.
- **`corpus/lekes-result-value-renamed`: arm B *worse* than A** (80 % against 40 %), on an edit to an
  uninvolved file (`mcp-tool-executor.adapter.ts`). A clear counter-signal to H1 on a real entry.

**What this sweep establishes, honestly.** A capable model, on this narrow corpus: (1) fixes
everything, on both sides — H2 has no purchase here; (2) costs fewer tokens with the folded report,
on large real code — H1's volumetric claim holds; (3) does **not** make fewer false starts with the
structured report — H1's central claim is **not** supported by this run, and the dominant failure
mode (stubbing a `.d.ts` on a module error) is independent of diagnostic format. This is **one**
measurement point, one model, a corpus the plan itself calls too narrow (T3 not done); it is not a
verdict, but it is the number obtained, and it tempers H1 rather than confirming it.

### Raw table

| target | arm | runs | green | turns | false start | ~tokens |
|---|---|---:|---:|---:|---:|---:|
| partial-interface-rename | A | 5 | 100 % | 5.0 | 0 % | 4 854 |
| partial-interface-rename | B | 5 | 100 % | 4.0 | 0 % | 4 341 |
| overload-mismatch | A | 5 | 100 % | 5.0 | 0 % | 4 720 |
| overload-mismatch | B | 5 | 100 % | 4.0 | 0 % | 4 325 |
| broken-barrel-export | A | 5 | 100 % | 4.6 | 0 % | 4 742 |
| broken-barrel-export | B | 5 | 100 % | 4.8 | 0 % | 5 229 |
| arity-changed | A | 5 | 100 % | 7.0 | 0 % | 7 101 |
| arity-changed | B | 5 | 100 % | 7.6 | 0 % | 9 133 |
| narrowed-union-member | A | 5 | 100 % | 4.6 | 0 % | 5 781 |
| narrowed-union-member | B | 5 | 100 % | 5.8 | 0 % | 7 489 |
| nullable-chain | A | 5 | 100 % | 7.4 | 0 % | 7 445 |
| nullable-chain | B | 5 | 100 % | 7.8 | 0 % | 7 665 |
| missing-required-property | A | 5 | 100 % | 5.8 | 0 % | 5 568 |
| missing-required-property | B | 5 | 100 % | 5.0 | 0 % | 5 481 |
| missing-multiple-properties | A | 5 | 100 % | 5.0 | 0 % | 3 847 |
| missing-multiple-properties | B | 5 | 100 % | 5.0 | 0 % | 4 001 |
| assignability-mismatch | A | 5 | 100 % | 5.0 | 0 % | 3 725 |
| assignability-mismatch | B | 5 | 100 % | 4.2 | 0 % | 3 704 |
| misspelled-property | A | 5 | 100 % | 4.0 | 0 % | 2 685 |
| misspelled-property | B | 5 | 100 % | 4.2 | 0 % | 3 457 |
| unconstrained-generic | A | 5 | 100 % | 4.0 | 0 % | 3 297 |
| unconstrained-generic | B | 5 | 100 % | 4.0 | 0 % | 3 431 |
| value-used-as-type | A | 5 | 100 % | 5.0 | 0 % | 4 439 |
| value-used-as-type | B | 5 | 100 % | 5.0 | 0 % | 4 527 |
| missing-type-import | A | 5 | 100 % | 4.6 | 0 % | 3 928 |
| missing-type-import | B | 5 | 100 % | 4.6 | 0 % | 4 059 |
| cannot-find-name | A | 5 | 100 % | 5.2 | 0 % | 4 484 |
| cannot-find-name | B | 5 | 100 % | 4.2 | 0 % | 3 543 |
| wrong-tsconfig-paths | A | 5 | 100 % | 5.0 | 0 % | 5 521 |
| wrong-tsconfig-paths | B | 5 | 100 % | 5.2 | 0 % | 6 091 |
| monorepo-cross-package | A | 5 | 100 % | 7.4 | 0 % | 8 454 |
| monorepo-cross-package | B | 5 | 100 % | 5.8 | 0 % | 6 166 |
| two-roots-one-file | A | 5 | 100 % | 4.0 | 0 % | 3 569 |
| two-roots-one-file | B | 5 | 100 % | 4.0 | 0 % | 3 536 |
| **two-independent-roots** | A | 5 | 100 % | 6.0 | **80 %** | 5 320 |
| **two-independent-roots** | B | 5 | 100 % | 5.8 | **100 %** | 5 278 |
| **phantom-dependency-pnpm** | A | 5 | 100 % | 4.4 | **100 %** | 3 959 |
| **phantom-dependency-pnpm** | B | 5 | 100 % | 5.4 | **100 %** | 6 275 |
| **yarn-pnp-project** | A | 5 | 100 % | 4.8 | **100 %** | 5 099 |
| **yarn-pnp-project** | B | 5 | 100 % | 7.2 | **100 %** | 10 761 |
| **corpus/lekes-result-value-renamed** | A | 5 | 100 % | 4.8 | **40 %** | 42 403 |
| **corpus/lekes-result-value-renamed** | B | 5 | 100 % | 4.8 | **80 %** | 30 770 |
| corpus/lekes-task-export-renamed | A | 5 | 100 % | 4.6 | 0 % | 69 109 |
| corpus/lekes-task-export-renamed | B | 5 | 100 % | 5.8 | 0 % | 53 652 |
| corpus/lekes-ok-arity-changed | A | 5 | 100 % | 4.2 | 0 % | 33 089 |
| corpus/lekes-ok-arity-changed | B | 5 | 100 % | 4.2 | 0 % | 11 191 |

*`~tokens` = `usage.total_tokens` summed over the loop, dominated by the initial framing re-emitted
each turn. Reproducible: `mise exec -- bun run eval:agent`, endpoint in `.env`.*

### Results on the frozen corpus — the real test of H1 (2026-07-29)

The first sweep (above) ran on fixtures that were too easy: the model fixed everything, with no
false start, whatever the framing. The **frozen corpus** — five deep cascades of 20 to 65
diagnostics, one cause, dozens of sites, an ambiguous fix — is written so that noise bites. Sweep
over the 5 entries, two models, `temperature: 0`, n=5: `cx/gpt-5.6-terra` (strong) and
`cx/gpt-5.4-mini` (weak). **This time H1 has purchase, and the signal is positive.**

> ⚠️ Read [B2](#b2--the-model-arm-re-measured-on-enriched-output-2026-08-03) before quoting these
> numbers. The control arm drifted between campaigns, and the `order-book` false-start metric is
> defective.

**gpt-5.6-terra (strong):**

| target | arm | green | turns | false start | ~tokens |
|---|---|---:|---:|---:|---:|
| dispatch-arity-changed | A | 100 % | 5.0 | 0 % | 16 503 |
| dispatch-arity-changed | B | 100 % | 4.8 | 0 % | 7 189 |
| mapper-argtype-changed | A | 100 % | 5.4 | 0 % | 23 071 |
| mapper-argtype-changed | B | 100 % | 5.2 | 0 % | 10 726 |
| **order-book-field-renamed** | A | 80 % | 7.2 | **100 %** | 25 215 |
| **order-book-field-renamed** | B | 100 % | 5.2 | **0 %** | 7 063 |
| registry-barrel-dropped | A | 100 % | 4.8 | 0 % | 8 809 |
| registry-barrel-dropped | B | 100 % | 5.0 | 0 % | 6 318 |
| shape-tag-renamed | A | 80 % | 8.8 | 100 % | 41 454 |
| shape-tag-renamed | B | 100 % | 7.6 | 100 % | 15 988 |

**gpt-5.4-mini (weak):**

| target | arm | green | turns | false start | ~tokens |
|---|---|---:|---:|---:|---:|
| dispatch-arity-changed | A | 100 % | 5.0 | 0 % | 15 171 |
| dispatch-arity-changed | B | 100 % | 4.4 | 0 % | 5 832 |
| mapper-argtype-changed | A | 100 % | 5.2 | 0 % | 18 048 |
| mapper-argtype-changed | B | 100 % | 5.0 | 0 % | 8 073 |
| **order-book-field-renamed** | A | 100 % | 5.0 | **100 %** | 18 997 |
| **order-book-field-renamed** | B | 100 % | 7.6 | **60 %** | 16 873 |
| registry-barrel-dropped | A | 100 % | 5.0 | 0 % | 8 649 |
| registry-barrel-dropped | B | 100 % | 4.0 | 0 % | 4 795 |
| shape-tag-renamed | A | 100 % | 9.6 | 100 % | 66 593 |
| shape-tag-renamed | B | 100 % | 7.4 | 100 % | 21 942 |

**What this says, honestly — and it is more encouraging than the first run.**

1. **Tokens: arm B does roughly half, on both models.** Strong total 115 052 → 47 284 (**41 %**),
   weak 127 458 → 57 515 (**45 %**). Folding the initial framing is paid for in context re-emitted
   each turn, and a small model pays dearly for it. H1's volumetric claim clearly holds.

2. **False starts: arm B reduces them — H1's core, finally visible.** Strong **10/25 → 5/25**
   (halved), weak **10/25 → 8/25**. The textbook case is **`order-book-field-renamed`** (an entity
   field renamed, read at 17 sites): the flat report pushes **both models to patch all 17 sites**
   (100 % false start), while the folded report — which names `interface Order declared at
   src/domain/order.ts` — sends the strong model to **the single declaration** (0 %) and the weak one
   much better (60 %, against 100 %). That is exactly H1's thesis, demonstrated. *(B2 later showed
   this particular result is partly an artefact of the metric — see
   [B2 §3](#3-and-the-false-start-metric-is-wrong-on-order-book).)*

3. **Fixing: arm B improves it too on the hard cascades.** On the strong side, `order-book` and
   `shape-tag` go from 80 % to 100 % green — the flat report made one run fail (12 turns patching
   sites without converging) where the folded report succeeds every time.

4. **But it is not a guarantee: `shape-tag-renamed` resists.** 100 % false start on both sides, on
   both models. Naming the cause (the renamed union tag) is not enough: the models still edit the
   consumers and the factory rather than going back to the declaration. Folding helps strongly when
   the cause is a clean declaration and the temptation is "patch N sites"; it does not immunise
   against a model that decides to treat symptoms.

**Corpus verdict.** On deep code — the real use case, not the fixtures — folding **saves ~half the
tokens and reduces false starts**, most clearly where the number of sites makes patch-by-symptom
tempting. The first "H1 unsupported" run was largely an artefact of tasks that were too easy; this
frozen corpus supports H1 on tokens and backs it on false starts, without overselling it
(`shape-tag` remains an honest counter-example).

*Reproducible: `AGENT_TARGETS=corpus/… AGENT_MODEL=… mise exec -- bun run eval:agent`. Corpus
committed under `corpus/`, endpoint in `.env`.*

---

## P2 — enrichment: what it adds and what it costs (2026-08-01)

Six codes get an enricher — **2339, 2353, 2345, 2554, 2305, 2724** — and the rule selecting them
fits in one line: *an enricher ships when the fact it produces is already captured and TypeScript
does not already print it.* These are exactly the codes whose payload is a **declaration site** and
a **member list**, two things a terminal reader cannot obtain any other way and an editor gives on
hover.

### The volume cost, measured against the P1 baseline

> ⚠️ **The absolute values in this table do not reproduce — corrected 2026-08-02.** The harness was
> then passing the renderer the project's **absolute** path as `rootLabel`, which `run.ts` does not
> do: arm B carried `/home/<user>/…` and grew by the length of the checkout path, on one arm only.
> **The deltas below remain valid** (the constant cancels in a difference); the totals and the B/A
> ratios do not. Re-measured after the fix, the same code gives **16 038 and B/A 51 %**. Detail in
> [P2/2307](#first-the-correction-the-harness-was-measuring-a-product-nobody-ships).

Same B0 harness, same 25 targets, the only variable being the presence of the `enrich` stage and of
the fact line under the cause header.

| | B chars, P1 | B chars, P2 | delta | B/A, P1 | B/A, P2 |
|---|---:|---:|---:|---:|---:|
| **total, 25 targets** | 16 861 | 17 538 | **+4.0 %** | **54 %** | **56 %** |
| `corpus/shape-tag-renamed` | 759 | 797 | +38 | 8 % | 9 % |
| `corpus/mapper-argtype-changed` | 990 | 1 043 | +53 | 17 % | 18 % |
| `corpus/order-book-field-renamed` | 574 | 657 | +83 | 21 % | 24 % |
| `corpus/registry-barrel-dropped` | 590 | 649 | +59 | 24 % | 26 % |
| `corpus/dispatch-arity-changed` | 773 | 821 | +48 | 39 % | 41 % |

**The number to remember: on a deep cascade, enrichment costs 40 to 85 characters — on the order of
10 to 20 tokens — for a declaration site and the list of real properties.** Folding pays the bill:
facts are rendered **once per group**, not once per diagnostic, so a 65-diagnostic cascade folded
into one entry carries a single property line. The overall ratio goes from 54 % to 56 % and the five
corpus targets stay between 9 % and 41 %.

The flip side is visible under `--all`, where there is no longer a group to amortise: every
diagnostic carries its facts. This is the intended behaviour — `--all` restores everything — but it
is where enrichment is expensive, and one should know that before measuring it by accident.

### Near-match does not exist, and that is a measurement

§5.2 asked for a "close candidate (Levenshtein)" on 2339. It is not implemented, and the reason is
not difficulty.

**TypeScript emits TS2551 / TS2724 *instead of* TS2339 / TS2305 as soon as its own spell-checker
finds a candidate.** Any diagnostic reaching an enricher is therefore, by construction, a case
TypeScript already examined and rejected. A suggestion from us can only fire where its own said no.

Measured 2026-08-01 over the 20 fixtures and the 5 corpus cascades, with a threshold transcribed
from `getSpellingSuggestion` (`len × 0.4 + 1`):

| code | diagnostics with a resolved member list | TS had suggested | our near-match fires |
|---|---:|---:|---:|
| 2339 | 113 | **0** | **38** |
| 2353 | 1 | 0 | 0 |
| 2305 / 2724 | 24 | 0 | 0 |

The 38 firings are **two distinct cases, both wrong**: `kind` → `id` and `side` → `id`, distance 2,
on `shape-tag-renamed`. On a four-letter name a distance of 2 means nothing. And the target is
precisely the cascade that **resists at 100 % in both arms in B1**: a fact naming `id` there would
send the model to the wrong declaration, which is exactly the failure rule 1 exists to prevent. No
`Fact` of type `near-match` is produced, on any code, and a test guards it.

### Two things §5.2 and §6 assumed that the fixtures disproved

1. **`checker.typeToString` of a named type returns its name, not its shape.** The §6 example showed
   `interface 'CreateUserInput'` followed by `{ id: string; email: string; name?: string }`; that
   rendering does not exist for a named type — you get `CreateUserInput`, and the line would read
   `type 'CreateUserInput' CreateUserInput`. **It is therefore the property list, not the shape, that
   carries the information on a named type.** The shape is rendered only where it is not the name: a
   resolved signature (`(action: string, actor: string): AuditEvent` on TS2554) or an anonymous type.
2. **"member" is the wrong word.** For a union, a *member* is a constituent, not a property: `1
   member: type` on `type Shape = Circle | Square` reads as "this union has one arm" when it should
   read "one property is accessible on it". The fixture that revealed it is called
   `narrowed-union-member`. The output says **`property`** for a type and **`export`** for a module.

### Four §5.2 codes do not ship, each for a named reason

- **2769** — §5.2 ranks it first, the measurement demotes it. Its whole payload is **already in
  `chain`**: TypeScript nests a TS2772 per candidate, carrying the signature *and* the error that
  killed it, and the renderer has printed that tree since P0. What §5.2 wanted to add — "which one
  fails latest, and on which argument" — **is not derivable from what is captured**: on
  `overload-mismatch`, the only branched-chain fixture, all three branches have the same depth and one
  leaf each. No structural signal separates them; ranking them would mean reading the messages
  semantically, i.e. guessing.
- **2322** — the divergence path requires both types as structures. Only the expected side is
  captured, and as a `SymbolRef`, not as a tree. — **Lifted 2026-08-02**, though not by deriving the
  divergence path; see [P2/2322](#p2--2322--the-last-enrichable-code-and-not-for-the-announced-reason-2026-08-02).
- **2307** — its facts are about the **installed topology** (declared or not in `package.json`,
  hoisting, PnP, `paths`). That is file reading, which a pipeline stage is not allowed to do (rule 4):
  a new `ProgramFacts` channel filled by the source is needed. The *causality* half of 2307 has
  shipped since B1/T1 and folds its three fixtures. — **Lifted 2026-08-02**: the channel exists
  (`ProgramFacts.resolution`) and 2307 is the seventh enricher. This diagnosis turned out to be exact
  to the word, which is the only reason to leave it written; see
  [P2/2307](#p2--2307--the-module-enricher-and-a-published-number-that-did-not-reproduce-2026-08-02).
- **18047 / 18048** — the origin of nullability is a control-flow question; nothing captured answers
  it. **Still open — the only §5.2 code that remains so.**

And **2551 ships as a deliberate no-op**: it is already good natively and §5.2 forbids degrading it.
It is absent from the table, so it renders exactly as TypeScript wrote it.

### A guard added to the harness, because an absurd total was nearly published

The private `.corpus/` (three copies derived from a repository that no longer exists on this machine)
gave an arm A at **0 diagnostics** and an arm B at 754: its own `tsc` no longer typechecked anything
while `TsApiSource` still walked the tree. Folded into the totals, that produced a **`B/A 1235 %`** —
a number describing a broken copy and reading as a claim about the product.

`measure.ts` now refuses those lines: both arms read the same tsconfig with the same compiler, so "A
finds 0, B finds many" is not a result but a stale target. The line is marked `incoherent`, excluded
from the totals, and the reason is printed. T3's committed `corpus/` is immune by construction —
which is exactly why it was committed.

---

## P2 / 2307 — the module enricher, and a published number that did not reproduce (2026-08-02)

Seventh enricher, and the only one that reads **no** `context`: its facts come from the
`ProgramFacts.resolution` channel that the source fills at ingestion (PROJECT.md §4). The blocker
announced on 2026-08-01 — "a channel is missing, not code" — proved exact to the letter: the channel
is 148 lines, the enricher 60.

### First, the correction: the harness was measuring a product nobody ships

`measure.ts` was passing the renderer `rootLabel: projectDir`, **the absolute path**, where `run.ts`
passes `relative(process.cwd(), facts.root)`. Arm B's `root:` line therefore carried `/home/<user>/…`
in the one metric this project publishes. Three consequences, all bad:

- **arm B grew by the length of the checkout path** — ~27 characters per target here, i.e. **~675
  over a total of 25**;
- **only one of the two arms was affected.** Arm A runs `tsc` with `cwd: projectDir` and prints
  relative paths. The bias therefore inflated exactly the side this repository claims is smaller;
- **two machines measuring the same commit published different B/A ratios**, with neither matching
  the tool's real output.

This is why the totals published on 2026-08-01 (**16 861 → 17 538, B/A 54 % → 56 %**) **do not
reproduce** on this repository: measured at `HEAD` with the corrected harness, the same code gives
**16 038, B/A 51 %**. The gap is a constant per-target offset, not a regression — and **the deltas
published in P2 remain valid**, the constant cancelling in a difference: the `+38 to +83 characters`
per corpus cascade re-measure identically. It is the **absolute values and ratios** of that table
that were contaminated, not its conclusions.

Fixed 2026-08-02; every number below is post-fix and reproducible from any checkout path.

### The cost of 2307, measured

Same harness, same 25 targets, the only variable being the registration of `2307` in the enricher
table.

| | B chars, without 2307 | B chars, with | delta | B/A without | B/A with |
|---|---:|---:|---:|---:|---:|
| **total, 25 targets** | 16 038 | 16 635 | **+3.7 %** | **51 %** | **53 %** |
| `wrong-tsconfig-paths` | 639 | 854 | +215 | 134 % | 179 % |
| `yarn-pnp-project` | 483 | 654 | +171 | 146 % | 198 % |
| `phantom-dependency-pnpm` | 454 | 615 | +161 | 150 % | 203 % |
| `two-independent-roots` | 423 | 473 | +50 | 190 % | 212 % |
| **the other 21 targets** | — | — | **0** | — | — |

**The number to read first: the cost is zero on the five corpus cascades.** None of them is a module
cascade — they are type cascades. 2307 is paid for only where it speaks, which is the property one
wants from a selective enricher, and **it is also this milestone's honest limit**: its value is
measured on no real code, only on three installer fixtures. The frozen corpus contains none, and
manufacturing one would be another fixture, not a measurement. *(Partly addressed on 2026-08-03 —
see [Real code](#real-code--keyziadata-explorer-2026-08-03), where 2307 fires on a real monorepo and
where its weakest observation shows.)*

**Folding still pays the bill, and this time it can be quantified exactly.** On
`phantom-dependency-pnpm`, the two fact lines weigh 160 characters and the measured delta is +161:
they are rendered **once** for three importers. Ungrouped — that is, under `--all` — the same two
lines would cost 480. The 3:1 ratio is facts being lifted to the group header, and its condition is
intersection over *all* members (PROJECT.md §6).

`two-independent-roots` is the case with no amortisation: its TS2307 is alone, so its single fact
(`no node_modules directory at the project root`) is paid at full price, +50 characters on a 423
report. That is the expected behaviour for an isolated diagnostic, and it is also why a negative
control's B/A ratio degrades — it has nothing to fold, by construction.

### What the three fixtures render, and why it is the right answer in all three cases

One TypeScript sentence, three different truths behind it — the observation for which the installer
fixtures were committed on 2026-07-28, finally exploited:

| fixture | what TypeScript says | what the output adds |
|---|---|---|
| `wrong-tsconfig-paths` | `Cannot find module '@domain/order'` | `matches the tsconfig 'paths' pattern '@domain/*', mapped to 'src/lib/*', baseUrl '.'` |
| `phantom-dependency-pnpm` | `Cannot find module 'qs'` | `'qs' is not declared in … package.json` · `installer: pnpm (pnpm-lock.yaml)` |
| `yarn-pnp-project` | `Cannot find module '@acme/http'` | `'@acme/http' is declared in dependencies … as '1.2.0'` · `installer: yarn (yarn.lock); '.pnp.cjs' at the project root, and no node_modules directory` |

`wrong-tsconfig-paths` is the only place in the product where a cause is named **outside any file of
the program**: a line of `tsconfig.json`, which no `declaredAt` can reach. And `yarn-pnp-project` is
the case where the most useful fact is the one that **refutes** the default reading: the package *is*
declared, *is* locked, *is* installed — these are three imports that only the launch mode leaves
unresolved.

### Three things that are not said, by decision

1. **Nothing about what is actually on disk.** `qs` is indeed present in `phantom-dependency-pnpm`,
   one level down under `node_modules/.pnpm/qs@6.11.2/`, and saying so would be the most useful line
   in this whole milestone. It is not said: reaching it requires either walking pnpm's **private**
   topology — a convention, not a declarative file (rule 10) — or parsing `pnpm-lock.yaml`, hence
   introducing a YAML parser, hence **the project's first runtime dependency**, for a single code. The
   installer and the missing declaration are rendered instead; between the two the case is
   identifiable, and every word is verifiable against a file.
2. **Nothing about what each installer does with an undeclared package.** That hoisting makes it
   reachable under npm and that pnpm's topology does not is true, documented — and is not a fact *about
   this project*. That is where a fact becomes an explanation, and an explanation is one step from a
   prescription (rule 1).
3. **Nothing at all when the manifest could not be read.** `two-independent-roots` has no
   `package.json`: "not declared" would be a claim about a file never opened. All that survives is the
   observation that no `node_modules` is there. `ResolutionFacts.dependencies` is **absent** rather
   than empty precisely to make that distinction representable (rule 5). *(Seen on real code
   2026-08-03: in a monorepo whose tsconfig sits in a directory with no manifest, this fallback is all
   2307 has left to say — see [Real code](#real-code--keyziadata-explorer-2026-08-03).)*

### Verification

`typecheck`, **534 tests** (518 before this milestone), `check` — all green. The **8 regenerated
snapshots** were re-read: the diff is **purely additive**, 24 insertions and 0 deletions, and touches
only the four targets carrying a TS2307. Both negative controls keep their entry count.

---

## P2 / 2739 · 2741 — the measurement that corrected §5.2 (2026-08-02)

Eighth and ninth enriched codes. But the substance of this milestone is not in the enrichment: it is
an **entry into `CONTEXT_CAPTURE_CODES`**, hence a **causality** gain, and it was a measurement made
before writing a line that revealed §5.2 had the wrong code.

### TS2739 does not truncate. TS2740 does, and it is not in the table of ten

§5.2 asks 2739/2741 for "the exact list of what is missing, without the rest of the type", on the
explicit grounds that TypeScript truncates its own. Probed on 5.9.3 with an interface missing 1 to 8
properties:

| missing properties | code emitted | list |
|---:|---|---|
| 1 | **TS2741** | names it (`Property 'p0' is missing …`) |
| 2 | TS2739 | `p0, p1` |
| 3 | TS2739 | `p0, p1, p2` |
| 4 | TS2739 | `p0, p1, p2, p3` |
| 5 | TS2739 | `p0, p1, p2, p3, p4` |
| 6 | **TS2740** | `p0, p1, p2, p3, and 2 more.` |
| 7 | **TS2740** | `p0, p1, p2, p3, and 3 more.` |
| 8 | **TS2740** | `p0, p1, p2, p3, and 4 more.` |

**The truncation §5.2 describes belongs to TS2740, which is not in its table of ten.** For 2739 and
2741 the list is already complete on screen, and repeating it would be exactly what `facts.ts`
forbids: a fact that restates the message. The payload §5.2 assigned them therefore does not exist
for them.

This is the third case where a table designated the wrong code (after 2724 found by the fixture, and
2769 demoted by `chain`), and the third where the AGENTS.md rule paid off: **before adding a code to a
table, check on a real fixture which one actually comes out.**

### What these two codes really bring: a shared cause

The target type (`Rect`, `Profile`) is named in each of those messages and **never located**. Yet it
is a shared cause: N construction sites of an interface break together the day it gains a required
member. Both codes therefore enter `CONTEXT_CAPTURE_CODES`, and the gain is a §5.1 gain.

Two node shapes reach the resolver, measured before implementation:

| shape | occurrences | what resolves |
|---|---:|---|
| name of a `VariableDeclaration` (`const origin: Rect = { … }`) | 4/6 | `getTypeAtLocation` **is** already the target type |
| `ReturnStatement` (`return { x, y }`) | 2/6 | the return type of the enclosing signature — `getTypeAtLocation` gives `any` there |

The second branch is not an optimisation: without it, 2 diagnostics out of 6 resolve nothing, and a
cascade would fold 2 sites out of 3 — **worse than not folding**, since the member left outside reads
as a second cause. With both: **6/6, one `declaredAt` per fixture.**

### The result, measured

| | without 2739/2741 capture | with | delta |
|---|---:|---:|---:|
| **total, 25 targets** | 16 635 | 16 948 | **+1.9 %** (B/A 53 % → 54 %) |
| **entries rendered** | 52 | **48** | **−4** |
| `missing-required-property` | 732 (3 entries) | 896 (**1 entry**) | +164 |
| `missing-multiple-properties` | 506 (3 entries) | 655 (**1 entry**) | +149 |

**Single-cause folding: 8/17 → 10/17.** The identical-`declaredAt` structural link goes from five
fixtures to seven.

**And the characters rise while the entries fall — this is expected, and it should be said rather than
hidden.** It is the same effect as on `partial-interface-rename`: below the three-site display cap,
all three diagnostics still print and the cause header is added on top. **The gain is structural, not
volumetric** — on a three-error fixture, `tsc` has no noise problem. What these two fixtures
demonstrate is that the link exists and can be captured; what they do not demonstrate is a saving, and
no corpus cascade carries these codes to settle it.

### A test that did its job

`test/causality.test.ts` had carried since P1 a `groups: []` assertion on
`missing-required-property`, with the comment: *"these tests exist so that, the day capture is
extended, the change shows up as a failure here rather than as a silent improvement nobody
measured."* It failed exactly as designed. It is rewritten to record the fold — and it keeps its
sharpest half: **the fold happens on the interface (`profile.ts:7:1`), not on the `related`
(`profile.ts:10:3`)**. Two distinct positions, so question 2 of the P1 plan stays closed in the sense
`assignability-mismatch` closed it.

### Verification

`typecheck`, **539 tests** (534 before), `check` — green. **4 snapshots** re-read: both fixtures go
from 3 entries to 1, and under `--all` each diagnostic carries its `required by:` line. 23 insertions,
15 deletions — the deletions are the `[2]`/`[3]` lines that folding replaces, not lost diagnostics
(`--all` restores them all, rule 2).

---

## P2 / 2740 — the code §5.2 described without naming (2026-08-02)

Added to the §5.2 table **by human decision**, the AGENTS.md rule forbidding a code from entering it
without asking. The previous section's measurement had shown that the truncation attributed to
2739/2741 belongs to 2740; it is therefore the only place where "the exact list of what is missing"
is information the reader does not already have.

### What it renders

One fixture, `missing-many-properties`, the only one emitting this code — three sites constructing a
six-field-short `ShipmentLabel`. Identical under **5.4.5 and 5.9.3**: three TS2740, four members
named, `and 2 more.`

```
[1] cause: interface 'ShipmentLabel' declared at src/shipping/label.ts:5:1
      8 properties: carrier, tracking, weightGrams, originPostcode, destinationPostcode, service, insuredCents, signatureRequired
      2 more not listed above: insuredCents, signatureRequired
    3 diagnostics, all TS2740
    …
```

**The completion is computed by subtraction against the verbatim message**, not by taking
`missing.slice(4)`. The tail is only the right answer if TypeScript prints in `getPropertiesOfType`
order — an assumption about its internals, not a verification. Comparing against what was actually
printed holds whatever the order, and degrades to "add nothing" if it ever stops printing names.

*(The `8 properties:` line and the completion line overlap partially — both names appear twice. That
is the price of a uniform rule: the header describes the cause type for **every** code that folds on a
declaration, and making an exception here would cost more in special-casing than in characters.)*

### Cost: zero on pre-existing targets

| | 25 targets | 26 targets |
|---|---:|---:|
| before 2740 | 16 948 | — |
| after 2740 | **16 948** | 18 010 |

`18 010 − 1 062 = 16 948` exactly: the new fixture is the only line that moves, and none of the other
twenty-five costs one extra character. The overall ratio goes from 54 % to 56 % **only** because a
target is added, and that target folds 3 diagnostics into 1 for 157 %.

### A renderer assumption this code brought down

Since 2026-08-01, suppressing a group member's facts was **all or nothing**, on the grounds — written
in the code — that *"a diagnostic's facts all describe the single symbol its context resolved, so if
the declaration is among them, the set is what the header already said"*.

**2740 refutes the premise.** Its `2 more not listed above: …` line is a property of the *failure*, not
of the target type: no `SymbolRef` can produce it, so no header had said it. Under the old rule it was
suppressed in the **default rendering** and survived only under `--all` — the enrichment absent from
exactly the view it is written for.

The rule is now **fact by fact**, against what the header actually printed: equality, **or suffix**.
The suffix is what recognises `'CreateUserInput' has 3 properties: id, email, name` and the header `3
properties: id, email, name` as the same list written twice, without hard-coding either phrasing. And
whatever remains common to all members without having been said is lifted **once** onto the header, as
for `module` groups.

**The rework is neutral, and the snapshot proves it: 32 insertions, 0 deletions.** None of the twenty
pre-existing fixtures changes by a character, which is the demonstration that the suffix rule
reproduces the old one everywhere it applied.

### Verification

`typecheck`, **560 tests** (539 before), `check`, and `fixtures:verify` on **21** fixtures — green. The
new fixture emits 3 × TS2740 under 5.4.5 as under 5.9.3, truncation threshold included.

---

## P2 / 2322 — the last enrichable code, and not for the announced reason (2026-08-02)

§5.2 asks 2322 for "the divergence path (`a.b[0].c`)". It remains underivable: it would require both
types as structures, and only the expected side is captured. **What is captured was worth more** —
where the target type is declared, and, for a union, what it actually allows.

`Type '"GBP"' is not assignable to type 'Currency'.` names the type in whose name the value is
refused, and says neither where `Currency` lives nor that it equals `"EUR" | "USD"`. Both are one
mouse-hover away in an editor and unreachable from a terminal — the very definition, in this project,
of a fact worth its tokens.

### The milestone's cleanest result: the anti-`related` fixture folds correctly

`assignability-mismatch` was written to **forbid** a rule: indexing on a `relatedInformation` span. Two
of its three diagnostics carry a `related` designating `currency.ts:9:3` — the `currency` *property* of
`Rate`, perfectly correct code — and the third carries none.

Resolved on the **contextual type**, all three land on `currency.ts:6:1`, `type Currency`, the line
`meta.json` names as root cause.

| key | reaches | where |
|---|---:|---|
| `related` span | 2 / 3 | `currency.ts:9:3` — correct code, not to be touched |
| **contextual type** | **3 / 3** | **`currency.ts:6:1` — the union that lost `"GBP"`** |

The fixture therefore now carries **both** halves of the argument instead of one: the `related` is the
wrong key, *and* the contextual type is a good one. Rendering:

```
[1] cause: type-alias 'Currency' declared at src/pricing/currency.ts:6:1
      "EUR" | "USD"
    3 diagnostics, all TS2322
```

### A measured inversion: object vs primitive

P2 had established that for a named **object** type, `typeToString` returns the name and it is the
**property list** that carries the information. For a union of **primitives**, it is the exact
opposite:

| type | `typeToString` | `getPropertiesOfType` | what informs |
|---|---|---|---|
| `interface CreateUserInput` | `CreateUserInput` (the name) | `id, email, name` | **the properties** |
| `type Currency = "EUR" \| "USD"` | `Currency` (the name) | **50 members of `String`** — `charAt`, `blink`, `fontcolor` | **the constituents** |

Neither generalises, hence a test on the type (`hasOwnMembers`) rather than a single rule. Verified in
both directions: `narrowed-union-member` — a union of **objects**, where the common list is the
information — comes out **to the character** as before, and an intermediate version that expanded every
union inflicted 130 characters of object literals on it in place of `1 property: type`, which is the
line that actually answers "why doesn't `.kind` exist on Shape".

### A guard extended, and a rule 1 that rang true

Capturing 2322 produced the first case of an expected type **outside the program**:
`unconstrained-generic` resolves to `Map` in `lib.es2015.collection.d.ts`. What came out:

```
expected type: interface 'Map' Map<string, User> at <ts-lib>/lib.es2015.collection.d.ts:19:1
'Map' has 12 properties: clear, delete, forEach, get, has, set, size, …, __@iterator@2156
```

True, verifiable, and worthless to the reader of a generic inference failure — plus two internal names
(`__@iterator@2156`) whose identifier changes from one compilation to the next. **And rule 1's
non-prescription test failed on it**, on `set` and `delete`, members of `Map`: the test was not wrong,
the output had no business being there.

Two fixes, both general:
- **an enricher never describes a declaration outside the program's files** — the same authority as
  §5.1 for a cause, `ProgramFacts.files`, all or nothing then native fallback (rule 5);
- **well-known symbol names (`__@…`) are filtered** out of `memberNames`, for the same reason
  `displayName` refuses `__type`.

### Cost

| | entries | B chars | B/A |
|---|---:|---:|---:|
| before 2322 | 49 | 18 010 | 56 % |
| after | **47** | 18 150 | 57 % |

**+140 characters, −2 entries.** The only item that moves is `assignability-mismatch`, 284 → 753
(265 %): three diagnostics folded into one entry, plus the header and the union line. As with the other
small fixtures, the gain there is **structural and not volumetric**.

**Single-cause folding: 12 out of 18** — against 8 out of 17 at the start of the day. The identical
`declaredAt` link carries nine fixtures, the shared specifier three.

### What 2322 does not fold, and that is correct

`unconstrained-generic` carries a TS2322 and **does not fold**: its expected type is `Map`, outside the
program, and the guard refuses it. This is the intended behaviour — the fixture is the witness for
diagnostics sitting *on* their own cause — and it is also the reminder that capturing a code does not
make all its diagnostics fold.

### Verification

`typecheck`, **560 tests**, `check` — green. Snapshot diff: **12 insertions, 8 deletions, on
`assignability-mismatch` alone**. Every other fixture, `narrowed-union-member` and
`unconstrained-generic` included, comes out to the character as before — the demonstration that the
fixes made to `symbolRefOfType` are targeted and not side effects.

---

## B2 — the model arm re-measured on enriched output (2026-08-03)

Same protocol as B1: five frozen-corpus cascades, two arms, two models, `temperature: 0`, n=5 — 100
runs. The only intended variable is that arm B now carries P2's enrichment (eleven codes).

**The headline result is negative, and it has to be read in full before concluding anything.**

### The raw numbers

| model | tokens A | tokens B | B/A | false start A | false start B |
|---|---:|---:|---:|---:|---:|
| strong `cx/gpt-5.6-terra` | 108 049 | 68 054 | **63 %** | **10/25** | **10/25** |
| weak `cx/gpt-5.4-mini` | 127 583 | 72 551 | **57 %** | **10/25** | **10/25** |

First-attempt fix: **100 % everywhere, both arms, both models.**

### 1. B1 and B2 do not subtract — the control arm moved

Arm A is raw `tsc`: **its code did not change by a line** between the two campaigns. It moved anyway.

| target | green B1 → B2 | turns | tokens |
|---|---|---|---|
| `order-book-field-renamed` A | 80 % → **100 %** | 7.2 → 5.8 | 25 215 → 23 280 |
| `shape-tag-renamed` A | 80 % → **100 %** | 8.8 → 7.2 | 41 454 → 34 888 |
| **total A** | | | 115 052 → 108 049 (**−6 %**) |

A control arm that shifts 6 % in tokens and lifts two fix rates from 80 to 100 % says one thing: **the
environment changed between 2026-07-29 and 2026-08-03** — self-hosted endpoint, same model *name*, not
necessarily the same service behind it. Any B1 → B2 difference is therefore confounded with that drift,
and **the only valid comparison is A against B inside B2**.

It is also a protocol lesson: `temperature: 0` does not give reproducibility across campaigns, and n=5
at zero temperature is not five independent samples but one repeated sample. A dated control arm is
what made this noticeable; without it, a regression would have been published.

### 2. What B2 establishes: the token gain, yes; the false start, no

- **Tokens: arm B is at 63 % (strong) and 57 % (weak) of arm A.** On the three targets where neither arm
  goes astray, it drops to **49 % / 52 %**. H1's volumetric claim holds, and it holds with enrichment
  included — so P2's overhead is absorbed and then some.
- **False starts: 10/25 in both arms, on both models. No gain.** B1's headline result — `order-book`
  going from 100 % to 0 % on the strong side — **does not reproduce**: both arms are at 100 % there.

### 3. And the false-start metric is wrong on `order-book`

While diagnosing the previous point, a defect appeared in **the measurement**, not the tool. The
fixture's `meta.json` says, in this order:

> "**either** keep `grandTotal` and update the reads, **or** revert to the name `total` in
> `src/domain/order.ts` […] The site-by-site alternative is a false start."

The first two propositions are given as **equally acceptable**, and the next sentence calls the first a
false start. But the metric counts every `write_file` outside `rootCauseFiles`, and `rootCauseFiles`
contains only the declaration: **updating the reads — a fix the fixture declares valid — is scored as
100 % false start.**

B2's arm B produced a green typecheck by choosing that very strategy. It is scored 100 %. In B1 the
model chose the other, and scored 0 %.

**Consequence for reading B1: its strongest result rests partly on the model's choice between two valid
strategies** — not solely on having understood the cause. The metric does not distinguish "patched 30
consumers without understanding" from "deliberately chose the *update the reads* strategy". That is the
defect to fix before replaying anything: either `rootCauseFiles` admits both sets, or the fixture settles
on a single strategy in its `expectedFix`.

The report handed to the model, for its part, has not regressed — it is better than in B1:

```
[1] cause: interface 'Order' declared at src/domain/order.ts:5:1
      7 properties: id, customerId, lines, grandTotal, currency, status, createdAt
    30 diagnostics, all TS2339
```

599 characters, the cause named, and `grandTotal` — the field's real name — written in black and white.
*(Untested hypothesis, worth keeping for later: naming the real property may make patching the sites
**more** attractive, not less. It is plausible and unmeasured; we do not publish it as a result.)*

### 4. What B2 says about P2, honestly

**No measurable benefit from enrichment on false starts or on fix rate.** Its cost, by contrast, is
measured and real (+13 % of report characters over the course of the day). In the agent loop that cost
disappears into the noise — arm B stays at 57–63 % of arm A — but **nothing in these 100 runs shows P2
gaining anything.**

This is not "P2 is useless": it is "P2 is not measured useful", and on this corpus the measurement
cannot settle it, because 2 of the 5 targets are saturated at 100 % in both arms and one of those two is
so for a metric reason. **The honest conclusion is that the question stays open and the current corpus
cannot answer it** — which puts corpus width ([Corpus limits](#corpus-limits)) ahead of adding features.

### 5. What to do before replaying

1. **Fix the metric**: `rootCauseFiles` must describe the set of files a *valid* fix may touch, or the
   fixture must admit only one strategy. As it stands, two of the five targets measure nothing.
2. **Widen the corpus** — five cascades of which two are unusable leaves three measurement points.
3. **Replay both arms in the same campaign**, always, and publish the control arm's drift as part of the
   result.

---

## Real code — `keyzia/data-explorer` (2026-08-03)

**The first time a P2 enricher fires on real code.** Every P2 number above is measured on fixtures and
on the frozen corpus; the [2307 section](#the-cost-of-2307-measured) states plainly that its value "is
measured on no real code". This section is a spot check on a private Nx monorepo, not a campaign — one
project, one run, no n=5, no model arm. It is recorded because it produced two things the fixtures did
not: a confirmation on code nobody wrote for us, and a folding gap that only real code made visible.

**Target:** `apps/data-explorer/tsconfig.json` in a private Next/Nx monorepo, **TypeScript 5.8.3**, 919
files checked. Errors are the developer's own, not authored for this measurement.

*Reproduction, and a trap worth knowing:* the repository root holds a **solution tsconfig** (`"files":
[]`, `"include": []`, four `references`) — the same configuration that made this target exit 2 in the
[P0 baseline](#baseline--2026-07-27-p0-before-causality). Both `tsc -p .` and `tssift --project .`
report **0 errors over 0 files** there; the referenced sub-projects have to be targeted individually.

```bash
# arm A
./node_modules/.bin/tsc --noEmit -p apps/data-explorer/tsconfig.json
# arm B — run from the tssift checkout: the target repository pins Node 18, tssift needs ≥ 20.19
mise exec -- node dist/cli.js --project <abs>/apps/data-explorer/tsconfig.json
```

### The numbers

| | diagnostics | entries | chars | vs tsc |
|---|---:|---:|---:|---:|
| `tsc --noEmit` | 19 | 19 | 3 564 | 100 % |
| `tssift` | 19 | **10** | 2 416 | **68 %** |
| `tssift --all` | 19 | 19 | 4 887 | 137 % (rule 2 upheld) |

Overall fold 19 → 10 (47 %); on the single cascade, **10 → 1 (90 %)**.

### The fold, and it is correct

```
[1] cause: class 'NotificationHelpers' declared at app/_helpers/notification.ts:4:1
      typeof NotificationHelpers
      'NotificationHelpers' has 1 property: prototype
    10 diagnostics, all TS2339
```

Ten TS2339 across four files, folded into one entry on an identical `declaredAt`. The file was opened to
check the enricher was not inventing:

```ts
export class NotificationHelpers {
}
```

The class body is **empty**. `has 1 property: prototype` is literally true, and it is the fact that
settles the case — without it, ten "Property 'error' does not exist" messages read as a typo on `error`.
Line 4, column 1: the right declaration. No imperative, rule 1 upheld.

This is the P2 claim working as designed on code nobody wrote for the fixture set: the payload is a
declaration site plus a member list, rendered once per group, on a cascade where `tsc` names the target
type ten times and locates it zero times.

### What it exposes: TS2304 and TS2552 do not fold, and here that is a gap

Entries `[2]`–`[9]` are **six TS2304 and two TS2552 for only four distinct names**:

| missing name | code | occurrences | entries rendered |
|---|---|---:|---:|
| `BlocksControllerGetEstimationImmobiliereRequest` | 2552 | 2 | 2 |
| `GetKeyscoreKeyscoreKeyscoreIdGetRequest` | 2304 | 2 | 2 |
| `GetKeyscoresByUserAndWorkspace…GetRequest` | 2304 | 2 | 2 |
| `PostKeyscoreKeyscorePostRequest` | 2304 | 2 | 2 |

The six TS2304 are in a **single file** (`app/_api/keyscore/apis/KeyscoreApi.ts`), an OpenAPI generator
output that lost its request types. This is the same shape as 2307 before T1: **the key is the name, not
the file.** A second causality pass indexed on the missing name — extracted from the verbatim message,
exactly as the 2307 rule extracts the specifier, and cross-checked against something the program
confirms — would fold these 8 entries into 4, taking the whole report from 10 entries to 6.

**The `cannot-find-name` fixture could never have shown this**: it carries **one name at one site**, so
its 0 % fold is a property of the fixture, not of the code. This is the first real witness of a 2304
cascade with repetition, and it is what puts the rule on the table. §5.1 classifies 2304 as a
near-certain root on the same footing as 2307, and its rule was the half of that list left unwritten in
P1.

*The rule is designed from this observation — see `.plans/` for the current plan. What is recorded here
is the measurement that motivated it, not the rule.*

### A second target, and 2307's honest limit on real code

`libs/chat-components/tsconfig.lib.json` in the same monorepo: 5 diagnostics (2 × TS7006, 3 × TS2307),
713 characters in arm A against 860 in arm B (**121 %**), **0 % fold**.

**The 0 % fold is correct**: the three TS2307 carry three *distinct* specifiers
(`@radix-ui/react-checkbox`, `react-hook-form`, `@radix-ui/react-select`), hence three roots. The rule
refuses to merge them, exactly as on `wrong-tsconfig-paths`. No cascade, so no H1 gain to show.

What 2307 renders on each of them is a single line: `no node_modules directory at the project root`.
That statement is **true and correctly scoped** — the project root is the tsconfig's directory,
`libs/chat-components/`, and there is indeed no `node_modules` there (`resolution.ts` tests
`join(root, "node_modules")` and does not walk up). It is also **all the enricher has left to say**,
because that directory holds no `package.json` at all: by [decision 3](#three-things-that-are-not-said-by-decision),
`ResolutionFacts.dependencies` is absent rather than empty, so no "not declared in package.json" fact is
produced. The behaviour is exactly as specified — and on a monorepo whose libraries have no manifest of
their own, the specification's most conservative branch is also its least informative one.

Recorded as an observation, not a bug: saying more would mean either walking up to a workspace root the
data does not name, or claiming something about a file never opened. Both are what rule 5 and decision 3
exist to prevent. Whether a monorepo-aware `ResolutionFacts` is worth its complexity is a question this
one data point does not answer.

### What this section does and does not establish

- **It does** show a P2 enricher producing a verified, useful, non-prescriptive fact on unseen real code,
  and a 90 % fold on a real cascade.
- **It does** produce the first real-code evidence for a 2304/2552 folding rule, which no fixture could
  have produced.
- **It does not** measure agent behaviour: no model was run on this project. B/A = 68 % is a character
  ratio, nothing more.
- **It is not a campaign.** One project, one run, private code that cannot be committed. It does not
  enter the totals of any table above, and it does not answer the question B2 left open.
