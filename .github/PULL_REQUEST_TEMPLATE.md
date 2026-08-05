<!--
One concern per pull request, please. Snapshot diffs are meant to be read, and a
PR mixing a refactor with a behaviour change makes that impossible.
-->

## What this changes

<!-- And why. If it fixes an issue, link it. -->

## Checks

```
mise exec -- bun run typecheck
mise exec -- bun run test
mise exec -- bun run check
```

<!-- Plus `bun run fixtures:verify` if you touched anything under fixtures/. -->

- [ ] All three pass
- [ ] `fixtures:verify` passes, or no fixture was touched

## Snapshots

- [ ] No snapshot changed
- [ ] Snapshots changed, **I read the diff**, and it is described below

<!-- If snapshots changed, say what the diff shows and why it is correct. A
diff larger than you expected is the test doing its job, not noise. -->

## The rules

Tick what applies; delete what does not. The full list with its reasoning is in
[CONTRIBUTING.md](../CONTRIBUTING.md).

- [ ] No `Fact.text` contains an imperative or a prescription
- [ ] No diagnostic is dropped — `--all` still restores everything
- [ ] TypeScript messages are still verbatim
- [ ] Nothing under `src/pipeline/` imports `typescript`
- [ ] No `node_modules/` is assumed and no package manager is spawned
- [ ] No new runtime dependency
- [ ] Anything the text renderer shows also exists in the JSON report
- [ ] A failure mode exits 2 with a named message rather than falling back quietly

## Measurement

<!-- If this could move a number in EVAL.md, say which one and by how much.
A number that moved the wrong way is a result, not a problem to hide. -->

- [ ] No measured number is affected
- [ ] A number is affected, and it is reported above
