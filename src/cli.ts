#!/usr/bin/env node
// The shebang matters beyond convenience: `bun run` honours it and delegates to
// Node, which is how this repo keeps bun as its package manager without ever
// making it the runtime (rule 11). `tsc` preserves it; a bundler might not,
// which is one more reason there is no bundler.
import { run } from "./run.js";

process.exitCode = run(process.argv.slice(2), {
  out: (text) => process.stdout.write(text),
  err: (text) => process.stderr.write(text),
});
