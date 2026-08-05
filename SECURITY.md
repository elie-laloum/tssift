# Security policy

## Reporting a vulnerability

Report privately to **pro@elielaloum.com**. Please do not open a public issue
for a vulnerability.

Include what you did, what happened, and the versions of tssift, TypeScript and
Node involved. A proof of concept helps but is not required to make a first
report.

Expect an acknowledgement within a week. This is a single-maintainer project
with no service-level commitment; if a fix is warranted it will be released and
the reporter credited unless they ask otherwise.

## Supported versions

Only the latest release receives fixes. The project has not reached `1.0` and
there are no maintained release branches.

## What tssift does, and what that implies

The threat model is short because the tool's surface is small.

**It reads. It does not write.** tssift never modifies your source files. It has
no `--fix`, no code actions, and no write path of any kind.

**It never spawns a package manager**, and never runs an install. It reads
declarative files only: `tsconfig.json`, `package.json`, lockfile *names*
(not their contents), and the presence of `.pnp.cjs` or a `node_modules`
directory.

**It has zero runtime dependencies.** The published package contains only its
own compiled output. TypeScript is a peer dependency, resolved **from the
project being analyzed** rather than from tssift's own installation, so the
compiler doing the work is the same one your `tsc` uses.

**It loads and runs your TypeScript compiler in-process**, which is the one
meaningful consequence to be aware of. Analyzing a project therefore executes
whatever `tsconfig.json` directs that compiler to load — as `tsc --noEmit`
itself would. Running tssift on an untrusted project is equivalent, in exposure,
to running `tsc` on it: do not do either with code you do not trust.

**Diagnostic text can contain code.** The report quotes TypeScript's messages
verbatim, and captured facts can include identifiers and declaration paths from
the analyzed project. If you paste a report into an issue, a chat, or a model
API, you are pasting fragments of that project.

## Out of scope

- Bugs in TypeScript itself. Report those upstream.
- Incorrect grouping or an inaccurate fact in a report: that is a correctness
  bug, and a serious one, but not a vulnerability. Open a normal issue —
  `CONTRIBUTING.md` says what to include.
