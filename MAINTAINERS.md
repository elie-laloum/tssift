# Maintainers

| Maintainer | Contact | Scope |
|---|---|---|
| Elie Laloum ([@elielaloum](https://github.com/elielaloum)) | pro@elielaloum.com | everything |

This is a single-maintainer project. That is a fact about its capacity, not an
invitation to lower expectations of it: the rules in
[CONTRIBUTING.md](./CONTRIBUTING.md) apply to the maintainer too, and the
evaluation in [EVAL.md](./EVAL.md) is published including the results that
undercut the project's own hypothesis.

## What that means for you

- **Response times are best-effort.** There is no service-level commitment, and
  none is implied by a fast reply to an earlier issue.
- **Decisions are written down.** The scope boundaries — which diagnostic codes
  are enriched, why grouping needs a structural link, why there is no `--fix` —
  live in `PROJECT.md` and `AGENTS.md`, with the reasoning. They are French;
  `CONTRIBUTING.md` carries the parts you need in English.
- **Some proposals will be declined on scope**, not on quality. Rewording
  TypeScript's messages, autofixing, and reimplementing `tsc` are stated
  non-goals. Adding a diagnostic code is possible but is a decision — open an
  issue before writing the code.

## Decision-making

There is no formal process. The maintainer decides, and records the reason where
the decision lives. Where a decision rests on a measurement, the measurement is
published in `EVAL.md` — including its limitations and the numbers that are
known not to reproduce.

## Security

Vulnerability reports go to the address above, privately. See
[SECURITY.md](./SECURITY.md).
