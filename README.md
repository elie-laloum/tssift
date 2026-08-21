# tssift

> Less noise, same truth.

`tssift` reads TypeScript diagnostics and presents them for an agent working in a
shell. It groups diagnostics that have a proven shared cause, ranks the most
explanatory causes first, and can fit the `agent-text` report to a token budget.
It preserves native TypeScript messages verbatim and never prescribes a fix:
it reports localized facts so the caller decides what to change.

> [!IMPORTANT]
> **Not published to npm.** The version is `0.0.1`, the packaging gates are in
> place, and no release has been made — so `npx tssift` will not find anything
> yet. The commands below describe the intended invocation; to try it today,
> clone this repository and build it. See [Development](#development).
>
> Read [Evaluation evidence](#evaluation-evidence) before adopting it. The
> character-count saving is measured and large. The claim that it makes an agent
> work better is **not** demonstrated, and the most complete campaign to date is
> a negative result.

## Use

Your project supplies TypeScript as a peer dependency. From its root:

```sh
npx tssift
```

Exact invocation forms:

```sh
npx tssift
npx tssift --project tsconfig.json
npx tssift --project packages/api --format json
npx tssift --all
npx tssift --budget-tokens 1200
```

CLI options:

- `--project <path>`: a `tsconfig.json` path, or a directory containing one;
  defaults to `./tsconfig.json` and does not search upward.
- `--format <agent-text|json>`: `agent-text` is the default; `json` contains the
  complete report.
- `--all`: print every diagnostic in full, ungrouped. It takes precedence over
  `--budget-tokens`.
- `--budget-tokens <n>`: approximately cap `agent-text` at `n` tokens, estimated
  as characters divided by four. Roots are never truncated, so a very small
  budget can be exceeded.
- `--help` / `-h`: print CLI help.

Exit codes:

- `0`: no error diagnostics.
- `1`: the analyzed project has type errors.
- `2`: tssift could not run (for example, an unreadable config or unsupported
  TypeScript version).

### Yarn Plug'n'Play

For a Yarn PnP project, use Yarn's runtime so it loads the PnP resolution map:

```sh
yarn tssift
```

A bare Node invocation can make valid PnP imports look unresolved. When that
condition is detected with `TS2307` diagnostics, tssift refuses rather than
presenting a misleading report.

## What it does—and does not do

`tssift` is not a replacement for `tsc`, a linter, or an autofixer. It does not
change source files, reword TypeScript's native messages, or tell you which fix
to make. Its report keeps all diagnostics in JSON; the default text renderer is
a ranked projection that suppresses repeated usage sites behind a cause, while
`--all` restores every line.

Grouping is deliberately conservative: it needs a structural link, such as a
shared declaration location or the same confirmed unresolved module. Independent
failures remain separate. Ranking puts causes with more explained diagnostics
first. Under a token budget, repeated usage sites are shed before lower-ranked
entries; a root is never dropped.

## Compatibility

- **Node.js:** `>=20.19`.
- **TypeScript:** peer dependency `>=5.4 <7` (tested across TypeScript 5.4–5.9 and 6.0). TypeScript 7 is refused with exit 2: the Go port removes the classic compiler API, so it needs a separate source rather than a wider range. Note that TypeScript 6 deprecates `baseUrl`, so a project using one gains a TS5101 — the same one its own `tsc` reports.
- **Platform:** tested on Ubuntu. Windows support is not claimed.
- **Project references:** solution-style `tsconfig` files with project references
  are rejected rather than silently checking nothing; point tssift at a concrete
  referenced project.

## Evaluation evidence

Two claims, and only the first of them holds.

**Fewer characters: confirmed, and large.** Grouping a cascade under its cause is
a mechanical saving that anyone can reproduce without a model. On real
third-party code broken by a one-line change, `agent-text` is **5–25%** of what
`tsc --noEmit` prints: 99 diagnostics across 50 files of `zod` render as one
entry, 118 across 28 files of `hono` as eight.

**Fewer tokens and fewer wrong edits in an agent loop: not confirmed.** The most
complete campaign to date — 6 cascades, 30 runs per arm, sampled rather than
repeated — puts the structured arm at **106% of raw `tsc`'s tokens**, fixing
**28/30 against 30/30**, with **9 false starts against 5**. It is ahead on no
behavioural metric.

The split is legible. On cascades with a single cause and no debris, the
structured arm runs at **34–77%** of the tokens with no behavioural cost. On the
one target carrying genuine *second-order* diagnostics, it inverts: **141%** of
the tokens, 8.2 turns against 5.8, and false starts in **80%** of runs against
0%. A report that is 10% of `tsc` by character can still cost more, because in an
agent loop the tokens are in the turns, not in the first message.

An earlier version of this section cited **59% fewer tokens** and false starts
halved, from a smaller campaign. **Those numbers do not reproduce** and the
reasons are documented rather than quietly dropped.

See [EVAL.md](./EVAL.md) for the method, the raw tables, the per-campaign drift,
and every limitation — including the two targets this campaign failed to
measure.

## Design rules

Fifteen invariants the code is written against. They are not style preferences:
each one exists because breaking it makes the tool confidently wrong, and source
comments throughout the repository cite them by number.

1. **Never prescribe a fix.** No `Fact.text` may contain an imperative. The tool
   says `interface 'User' is declared at src/types.ts:4:1 and has 2 properties:
   id, email`; it never says "add the missing property". A deterministic tool
   that states a wrong fix confidently is worse than a vague message, because
   the caller will follow it without questioning. A test walks every fact
   produced over every fixture and fails on imperative or modal vocabulary.
2. **Never drop a diagnostic — only rank it lower.** `--all` always restores
   everything and the JSON report always carries the complete list. The pipeline
   returns `{ diagnostics, groups }` where `diagnostics` is untouched; grouping
   is a rendering index, not a filter.
3. **The TypeScript message stays verbatim.** `NormalizedDiagnostic.message` is
   byte-for-byte what `tsc` produced, so a reader can always get back to native
   output. Rewording is a separate, unproven hypothesis, gated behind
   measurement.
4. **The pipeline never touches the `TypeChecker`.** Everything it needs is
   captured at ingestion, on two channels: `NormalizedDiagnostic.context` (per
   diagnostic, selective, driven by a code list) and `ProgramFacts` (per
   program). A file under `src/pipeline/` importing `typescript` breaks this,
   and a test enforces it. This is what will let a TypeScript 7 source be
   *added* rather than force a rewrite — the Go port removed
   `ts.createProgram`.
5. **Low confidence falls back to the native format.** Degrading is a success,
   not a failure.
6. **Never truncate a root cause** under a token budget. It is the one thing the
   caller has to read first.
7. **`typescript` is a peer dependency (`>=5.4 <7`), never bundled, and resolved
   from the analyzed project** rather than from our own installation.
   Type-checking with a different compiler than the user's own `tsc` would
   produce diagnostics their reference tool does not produce.
8. **Nothing ships ahead of the numbers.** New diagnostic codes and new surfaces
   wait for the evaluation to justify them, code by code.
9. **No `--fix`, no codefixes, no reimplementation of `tsc`.** Stated non-goals.
10. **Never assume `node_modules/` exists, and never spawn a package manager.**
    We read declarative files only — `package.json`, lockfile *names*,
    `.pnp.cjs`, `tsconfig.json`. Yarn PnP has no `node_modules` at all and
    pnpm's topology differs from npm's; both are supported and both are in CI.
11. **Tests run on Node, never under `bun test` or `bun run --bun`.** Bun manages
    development dependencies; Node is the runtime users have.
12. **Local commands go through `mise exec --`,** never a binary called by
    absolute path. A hard-coded path bypasses the pinned version silently. This
    does not apply to CI, which installs its own matrix of versions.
13. **The renderer's output is English, frame included, and the TypeScript
    message inside it is raw.** No rewording before the evaluation justifies it
    code by code.
14. **`json` is the complete report; `agent-text` is a lossy projection of it.**
    Never the reverse: every field in the text exists in the JSON with the same
    meaning.
15. **No silent fallback.** An unsupported TypeScript version, an unresolvable
    peer, an unreadable config: exit **2** with a message naming what was looked
    for and where — never a warning on stderr followed by a wobbly run. Agents
    do not read stderr.

## Development

The package has zero runtime dependencies. The repository uses Bun to manage
development dependencies, but its CLI and tests run on Node.

Until there is a release, this is how to try it:

```sh
git clone https://github.com/elielaloum/tssift.git
cd tssift
bun install --frozen-lockfile
bun run build
node dist/cli.js --project /path/to/your/tsconfig.json
```

Useful checks:

```sh
bun run typecheck
bun run build
bun run test
bun run fixtures:verify
bunx biome ci
npm pack --dry-run
```

`npm pack` runs the build through the `prepack` lifecycle. A future `npm publish`
runs typecheck, tests, fixture verification, and Biome's non-writing CI check
through `prepublishOnly`.

The toolchain is pinned with [mise](https://mise.jdx.dev); CI deliberately does
not read that pin, because its job is to sweep a matrix a single version would
contradict — TypeScript 5.4 → 6.0, Node 20/22/24, and the five installers.

The renderer's output is test content: any format change breaks snapshots, and
that is intentional. **Read the snapshot diff; never regenerate it blind.**

## Project documents

| | |
|---|---|
| [EVAL.md](./EVAL.md) | the method, the raw tables, every campaign including the ones that failed |
| [CHANGELOG.md](./CHANGELOG.md) | what a release would contain, and the known limitations |
| [SECURITY.md](./SECURITY.md) | how to report a vulnerability, and what the tool actually does to your machine |

This is an early public preview. Issues are welcome — especially a **wrong
grouping**, which is the most serious defect this tool can have, or a **refusal
that should not have happened** (exit 2 on a project that ought to work). Please
include your TypeScript version, your Node version, your package manager, and
where you can a minimal project that reproduces.

## License

[MIT](./LICENSE) © 2026 Elie Laloum.
