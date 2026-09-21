# Reproduce the diagnostic comparison

Build the repository using the README quick start, then run:

```sh
mise exec -- node node_modules/typescript/bin/tsc --project corpus/dispatch-arity-changed/before --noEmit --pretty false
mise exec -- node dist/cli.js --project corpus/dispatch-arity-changed/before
mise exec -- node dist/cli.js --project corpus/dispatch-arity-changed/before --format json
```

These commands deliberately analyze a broken fixture, so a nonzero exit is expected. It changes the arity of one shared function, yielding 24 errors across 19 files. tssift groups them under the shared declaration.

The animation replays real CLI output with explanatory annotations. The original [TypeScript output](../demo/raw-typescript.txt), [grouped report](../demo/grouped.txt) and [recorded counts](../demo/summary.json) are included. This fixture measures presentation mechanics, not real-world agent effectiveness; see [EVAL.md](../EVAL.md) for that evidence.
