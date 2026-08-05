# Contributing

Thanks for looking. This project has an unusually explicit set of rules, and
they exist because the tool makes claims about correctness that are easy to
break by accident. Reading this page first will save you a rejected pull
request.

Note the working language split: **code, comments, identifiers and this page are
English**; the internal design documents (`PROJECT.md`, `AGENTS.md`, `.plans/`)
are French, because they were written for the author. `README.md` and `EVAL.md`
are English — they are the two documents written to be read and reproduced by
someone else. You do not need French to contribute.

## Getting set up

The toolchain is pinned with [mise](https://mise.jdx.dev). Bun manages
development dependencies; the CLI and the tests run on **Node**.

```sh
mise install
mise exec -- bun install
```

Every command below is written with the `mise exec --` prefix. Keep it: there
may be another Bun or Node earlier on your `PATH`, and hitting it silently gives
you a different version than the pinned one.

```sh
mise exec -- bun run typecheck   # tsc --noEmit over our own code
mise exec -- bun run test        # vitest, executed by Node
mise exec -- bun run check       # biome check --write
mise exec -- bun run build       # tsc → ESM + .d.ts, no bundler
```

If you touched anything under `fixtures/`, add:

```sh
mise exec -- bun run fixtures:verify
```

It checks that every fixture's `before/` really does fail to compile, under both
TypeScript 5.4.5 and 5.9.3.

CI runs the same commands without mise, across a TypeScript axis (5.4 → 6.0), a
Node axis (20, 22, 24), and an installer axis (npm, pnpm, yarn node-modules,
yarn PnP, bun).

## The rules that are not negotiable

These are not style preferences. A change that breaks one of them will be asked
to change, however good the rest of it is.

**1. Never prescribe a fix.** No `Fact.text` may contain an imperative. The tool
says `interface 'User' is declared at src/types.ts:4:1 and has 2 properties: id,
email`. It never says "add the missing property". A deterministic tool that
confidently states a wrong fix is worse than a vague message, because the caller
will follow it without questioning. A test walks every fact produced over every
fixture and fails on imperative or modal vocabulary.

**2. Never drop a diagnostic — only rank it lower.** `--all` must always restore
everything, and the JSON report always contains the complete list. Grouping is a
rendering index, not a filter. The pipeline returns `{ diagnostics, groups }`
where `diagnostics` is untouched.

**3. The TypeScript message stays verbatim.** `NormalizedDiagnostic.message` is
whatever `tsc` produced, byte for byte, so a reader can always get back to
native output. Rewording is a separate, unproven hypothesis and is gated behind
measurement.

**4. The pipeline never touches the `TypeChecker`.** Everything the pipeline
needs is captured at ingestion, on two channels: `NormalizedDiagnostic.context`
(per diagnostic, selective, driven by a code list) and `ProgramFacts` (per
program). If a file under `src/pipeline/` imports `typescript`, the rule is
broken. This is what will let a TypeScript 7 source be *added* rather than force
a rewrite — the Go port removed `ts.createProgram`.

**5. Low confidence means fall back to the native format.** Degrading is a
success, not a failure.

**6. Never truncate a root cause** under a token budget. It is the one thing the
caller must read first.

**7. Never assume `node_modules/` exists, and never shell out to a package
manager.** We read declarative files only — `package.json`, lockfile *names*,
`.pnp.cjs`, `tsconfig.json`. Yarn PnP has no `node_modules` at all and pnpm's
topology is different from npm's; both are supported, and both are in CI.

**8. No silent fallback.** An unsupported TypeScript version, an unresolvable
peer, an unreadable config: exit **2** with a message naming what was looked for
and where. Not a warning on stderr — agents do not read stderr. `0` means clean,
`1` means the analyzed project has type errors, `2` means tssift could not run.

**9. No new runtime dependencies.** The package has zero, and that is a feature:
it stays installable with `npx` and there is nothing to bundle. A dependency
needs a justification, in the pull request, before the code.

**10. `json` is the complete report; `agent-text` is a lossy projection of it.**
Never the reverse. Every field in the text exists in the JSON with the same
meaning.

## Snapshots

The renderer's output is test content. Any format change breaks snapshots, and
that is intentional — it is how a change becomes visible.

**Read the snapshot diff. Never regenerate it blind.** If a diff is larger than
you expected, that is the test doing its job. Say in the pull request what the
diff shows and why it is correct.

## Adding support for a diagnostic code

The set of enriched codes is deliberately small and closed: covering a dozen
codes completely beats covering sixty halfway. Adding one is a decision, not a
patch — **open an issue first**.

If it is agreed, the order matters:

1. **Write the fixture first.** No fixture, no enricher. It goes in
   `fixtures/<kebab-name>/` with a `meta.json` and a `before/` project that
   genuinely fails to compile.
2. **Check what the code actually emits.** TypeScript picks between neighbouring
   codes based on the names in your source, not on the kind of failure — a
   near-miss identifier turns TS2305 into TS2724 and TS2339 into TS2551. Verify
   against a real fixture which one fires.
3. **Check the data is already captured.** If it is not, add it to the capture
   in `src/sources/`, never to the enricher (rule 4).
4. **Implement `src/pipeline/enrich/<code>.ts`** and register it in
   `enrich/index.ts`.
5. **Produce only verifiable facts** — a declaration and its position, a member
   list, an edit distance. Not interpretation.
6. **Add the non-prescription test and the snapshot.**

## Fixtures

```
fixtures/<kebab-name>/
  meta.json     { rootCause, expectedFix, tags, difficulty, purpose?, ... }
  before/       a project that does not compile
```

There is no `after/`. The expected corrected state lives in prose in
`meta.json.expectedFix`, which is what the evaluation harness reads.

Every `before/` is **self-contained**: its own complete `tsconfig.json`, with no
`extends` pointing outside the folder. The evaluation copies the folder and
expects the copy to still run. The duplication buys that property.

Unless the fixture's subject *is* the configuration, copy this block verbatim:

```json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler"
  }
}
```

If you deviate, say so line by line in `meta.json.deviatesFromCanonicalConfig`,
so a reader can tell a deliberate deviation from a mistake.

## Measurement

This project exists to produce numbers, and some of them are unflattering. The
published evaluation is a **negative result** on its own behavioural hypothesis,
and that is on purpose.

If you change something that could move a number, say which one and by how much.
If you measure something that contradicts a claim in `README.md` or `EVAL.md`,
that is a valuable contribution — report the measurement you got, not the one
you hoped for.

## Pull requests

- One concern per pull request. Snapshot diffs are read; a pull request mixing a
  refactor with a behaviour change makes that impossible.
- Commit messages and code comments in English.
- Say what you measured, and paste the checks you ran.
- If your change touches a decision recorded in `PROJECT.md`, update
  `PROJECT.md` in the same change.

## Reporting a bug

Two kinds are especially welcome, because they are the ones we cannot generate
ourselves:

- **A wrong grouping.** Two independent failures folded under one cause is the
  most serious defect this tool can have. Include the `--format json` output.
- **A refusal that should not have happened** — exit 2 on a project that ought
  to work.

Please include your TypeScript version, your Node version, your package manager,
and, where you can, a minimal project that reproduces.
