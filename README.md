# tssift

> Less noise, same truth.

`tssift` reads TypeScript diagnostics and presents them for an agent working in a
shell. It groups diagnostics that have a proven shared cause, ranks the most
explanatory causes first, and can fit the `agent-text` report to a token budget.
It preserves native TypeScript messages verbatim and never prescribes a fix:
it reports localized facts so the caller decides what to change.

This is a `0.0.1` preview release preparation. The npm package and GitHub URL
below are intended future public locations; do not assume they are live yet.

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
- **TypeScript:** peer dependency `>=5.4 <6` (tested across TypeScript 5.4–5.9).
- **Platform:** tested on Ubuntu. Windows support is not claimed.
- **Project references:** solution-style `tsconfig` files with project references
  are rejected rather than silently checking nothing; point tssift at a concrete
  referenced project.
- **TypeScript 6 and 7:** not supported; tssift exits with code 2 rather than
  attempting a degraded run.

## Evaluation evidence

The result is bounded, not a universal savings claim. In the frozen-corpus run
with **`cx/gpt-5.6-terra` only**, five deep cascades and 25 runs per arm,
the structured arm used **approximately 59% fewer tokens**: **115,052 →
47,284**. In that same run, false starts were **10/25 → 5/25**. The result has a
material counterexample: `shape-tag-renamed` still produced false starts in
**100%** of runs in both arms.

See [EVAL.md](./EVAL.md) for the method, raw tables, model-specific results, and
limitations.

## Development

The package has zero runtime dependencies. The repository uses Bun to manage
development dependencies, but its CLI and tests run on Node. Useful checks:

```sh
bun install --frozen-lockfile
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

## Planned public locations

- Repository: <https://github.com/elielaloum/tssift>
- Issues: <https://github.com/elielaloum/tssift/issues>
- Package: `tssift` on npm

## License

[MIT](./LICENSE) © 2026 Elie Laloum.
