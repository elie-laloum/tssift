# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

While the major version is `0`, the output format of `agent-text` and the shape
of the `json` report may change in a minor release. The JSON report is the one
intended to be consumed programmatically; changes to it will be listed here.

## [Unreleased]

Nothing yet.

## [0.0.1] — unreleased

**Not published to npm.** `package.json` carries this version and the packaging
gates are in place, but no release has been made. This entry describes what a
first release would contain.

### Added

- **CLI.** `tssift` runs against a `tsconfig.json` and reports grouped
  diagnostics. `--project`, `--format`, `--all`, `--budget-tokens`, `--help`.
  Exit `0` clean, `1` type errors in the analyzed project, `2` tssift could not
  run.
- **Causality detection.** Diagnostics sharing a proven structural link are
  folded under one cause and the causes are ranked by how many diagnostics each
  explains. The threshold is deliberately strict: a shared declaration site, a
  shared unresolved module specifier, or a shared missing name. Independent
  failures stay separate — nothing is inferred from proximity or from a
  diagnostic's `related` span, which points where the compiler chose to explain
  *that* diagnostic rather than at a cause.
- **Enrichment for twelve diagnostic codes** — 2305, 2307, 2322, 2339, 2345,
  2353, 2554, 2724, 2739, 2740, 2741, and the 18047/18048 family. Each attaches
  facts a checker knows and `tsc` does not print: where a type is declared, the
  members it actually has, which overload failed, whether a missing package
  appears in `package.json`. Facts are rendered once per group, never once per
  diagnostic, and never contain a prescription.
- **Package-manager awareness.** npm, pnpm, yarn (node-modules), yarn Plug'n'Play
  and bun. Installer detection reads lockfile names and declarative files only;
  no `node_modules` directory is ever assumed and no package manager is ever
  spawned. Two lockfiles report `unknown` and list both rather than picking a
  winner.
- **Yarn PnP misread guard.** Run outside the Yarn runtime, a bare Node process
  cannot load the PnP resolution map, and valid imports look unresolved. When
  that state is detected together with a `TS2307`, tssift exits 2 rather than
  printing a plausible and entirely wrong report.
- **Two renderers.** `agent-text` is the default, a ranked and lossy projection;
  `json` is the complete report and contains every field the text has.
- **Token budget.** `--budget-tokens` sheds repeated usage sites before
  lower-ranked entries. A root cause is never truncated, so a very small budget
  can be exceeded rather than silently obeyed.
- **Evaluation harness and published results.** A deterministic character-count
  measurement with no model, and a model-in-the-loop harness measuring fix rate,
  turns and wrong-file edits. Results, method and limitations are in
  [EVAL.md](./EVAL.md) — including the campaign that produced a negative result
  for the project's behavioural hypothesis, and the list of published numbers
  that are known not to reproduce.
- **24 fixture projects** and a frozen public corpus referenced by commit sha,
  vendoring no third-party code.

### Known limitations

- **The behavioural benefit is not demonstrated.** Grouping reliably produces a
  much shorter report — 5–25 % of raw `tsc` on real third-party code — but the
  most complete campaign to date does not show that this makes an agent cheaper
  or more accurate overall, and shows it losing on a cascade carrying
  second-order diagnostics. See [EVAL.md](./EVAL.md) before relying on a token
  claim.
- **TypeScript 7 is refused** with exit 2. The Go port removes the classic
  compiler API, so support means writing a second source rather than widening a
  range.
- **TypeScript 6 deprecates `baseUrl`**, so a project using it gains a TS5101 —
  the same one its own `tsc` reports.
- **Solution-style `tsconfig.json` files** with project references are rejected
  rather than silently checking nothing. Point tssift at a concrete referenced
  project.
- **Windows is untested** and not claimed. CI runs on Ubuntu only.

[Unreleased]: https://github.com/elielaloum/tssift/compare/main...HEAD
[0.0.1]: https://github.com/elielaloum/tssift/releases/tag/v0.0.1
