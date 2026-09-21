<p align="right"><a href="README.fr.md">Français</a></p>
<img src="assets/cover.svg" width="100%" alt="tssift — Find the cause behind the cascade.">

[![CI](https://github.com/elie-laloum/tssift/actions/workflows/ci.yml/badge.svg)](https://github.com/elie-laloum/tssift/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-242b3a)](LICENSE)

**One changed declaration can produce a wall of TypeScript errors. tssift connects the related diagnostics and puts the shared cause first.**

Native messages stay intact. The complete report stays available. You decide what to change.

[Try it](#quick-start) · [Watch the demo](#see-it-in-action) · [Evaluation results](#what-the-evidence-says) · [Full guide](docs/guide.md)

## See it in action

<a href="assets/demo.mp4"><img src="assets/demo.gif" width="100%" alt="tssift — recorded TypeScript diagnostic comparison"></a>

<sub>Real CLI output from the dispatch-arity corpus fixture. Replay includes explanatory annotations; timing is edited for readability. No model is involved.</sub>

[Watch the MP4](assets/demo.mp4) · [Reproduce the comparison](docs/demo.md)

## Get to the useful part

| When the output gets noisy | What tssift gives you |
| :--- | :--- |
| One signature breaks many call sites | A shared declaration, its location and the related diagnostics. |
| An agent has limited context | Ranked text with an optional approximate token budget. |
| You need the complete picture | Full JSON or `--all`, with every diagnostic preserved. |
| The relationship is uncertain | Conservative grouping; unrelated failures stay separate. |

## Quick start

**Early preview, version 0.0.1. Not published to npm.** Build from source using the toolchain declared in `mise.toml`:

```sh
git clone https://github.com/elie-laloum/tssift.git
cd tssift
mise install
mise exec -- bun install --frozen-lockfile
mise exec -- bun run build
mise exec -- node dist/cli.js --project /path/to/your/tsconfig.json
```

The analyzed project supplies its own TypeScript installation. Node.js 20.19+ and TypeScript 5.4–6.x are supported; the project tests Ubuntu and does not claim general Windows support.

```sh
# Fit the text report to an approximate budget
mise exec -- node dist/cli.js --project /path/to/app --budget-tokens 1200

# Keep every diagnostic in a machine-readable report
mise exec -- node dist/cli.js --project /path/to/app --format json

# Show every diagnostic in full
mise exec -- node dist/cli.js --project /path/to/app --all
```

Exit `0` means no type errors, `1` means the project has type errors, and `2` means tssift could not run. A root cause is never truncated, so a very small requested budget can be exceeded.

## What the evidence says

**Smaller output is demonstrated. Better agent performance is not.** Existing evaluations report substantial character-count compression on real projects. The largest recorded agent campaign used 106% of raw `tsc`’s tokens, solved 28/30 cases against 30/30, and recorded 9 false starts against 5.

Use tssift for a more compact view of related diagnostics. Treat improved agent outcomes as an open research question. [EVAL.md](EVAL.md) preserves the measurements, negative results, earlier non-reproducing claims and methodological limits.

## Built to preserve the facts

- TypeScript’s own messages are kept verbatim.
- Grouping needs a structural link, such as a shared declaration or confirmed unresolved module.
- Source files are read, never modified; no fix is prescribed.
- JSON contains the full diagnostic list; text is a ranked projection of it.

Solution-style project references are refused: point at a concrete project. TypeScript 7 is not supported. Yarn PnP requires the project’s Yarn runtime. See [compatibility and invocation details](docs/guide.md#compatibility).

## Develop and contribute

```sh
mise exec -- bun run typecheck
mise exec -- bun run test
mise exec -- bun run fixtures:verify
```

Wrong groupings and unexpected refusals are especially useful bug reports. Include TypeScript, Node and package-manager versions with a minimal reproduction. Review expectations and all design invariants remain in the [full guide](docs/guide.md#design-rules).

[Evaluation](EVAL.md) · [Changelog](CHANGELOG.md) · [Security](SECURITY.md) · [MIT license](LICENSE)

[GitLab origin](https://gitlab.elielaloum.com/elielaloum/tssift) · [Public GitHub mirror](https://github.com/elie-laloum/tssift)

The private GitLab repository is the source of record. Changes are synchronized to GitHub.
