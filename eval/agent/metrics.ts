/**
 * The B1 metrics (PROJECT.md §7), and how a set of runs rolls up.
 *
 * The load-bearing one is the **false start**: a `write_file` to a path outside
 * the fixture's known root-cause set. It is the direct test of H1 — a noisier
 * diagnostic sends the agent to edit the wrong file — and it is why the harness
 * intercepts `write_file` rather than reading a transcript after the fact.
 *
 * **The consumer route is scored separately, and that is a 2026-08-04 repair.**
 * On a wide rename cascade, two edits both make the project compile: change the
 * one declaration, or patch every consumer of it. Two corpus entries
 * (`order-book-field-renamed`, `shape-tag-renamed`) say in their own
 * `expectedFix` that both settle the cascade — and then B1 scored the consumer
 * route as a false start, because `rootCauseFiles` held the declaration alone.
 * That is a contradiction in the ground truth, not a measurement: it is why B2
 * records the `order-book` false-start rate as defective.
 *
 * The repair does not decree either route invalid. A `meta.json` may declare
 * `consumerFiles`, the sites its own prose accepts as an alternative fix; a
 * write there is **not** a false start and lands in its own column instead.
 * A false start stays what §7 says it is — a write to a file no fix involves.
 */
export interface RunResult {
  target: string;
  /** "A" (raw tsc) or "B" (tssift agent-text). */
  arm: "A" | "B";
  /** The project compiled cleanly at the end of the loop (first-try fix). */
  fixed: boolean;
  /** Assistant turns until the loop ended. */
  turns: number;
  /** At least one write landed outside both the root-cause set and the declared consumer set. */
  falseStart: boolean;
  /** Distinct paths written that are in neither set. */
  strayFiles: string[];
  /**
   * At least one write landed on a declared `consumerFiles` site — the agent
   * took the wide route rather than the declaration. Not a false start: the
   * fixture says it compiles. Always false where no consumer route is declared.
   */
  consumerRoute: boolean;
  /** Distinct declared consumer paths written. */
  consumerWrites: string[];
  /** The target declares a `consumerFiles` route at all — distinguishes "not taken" from "not offered". */
  consumerRouteDeclared: boolean;
  /**
   * The run **tried** to write a TypeScript configuration file and was refused.
   *
   * Added 2026-08-04, after a campaign in which zod's two completed runs did it
   * and both were scored `fixed`. Widening an `exclude` list until the failing
   * files leave the program produces `0 errors` without touching the bug: the
   * harness saw a green typecheck and reported a fix.
   *
   * Flagging it was not enough — a flagged run still measures nothing, because
   * the cascade is never read. Since 2026-08-05 `write_file` refuses the write
   * outright (`isCompilerConfig`, tools.ts) and this flag records the attempt.
   * It is deliberately **not** a false start: nothing was written, and the
   * attempt is a behaviour worth its own column rather than a file edit worth
   * counting. A target whose runs light this up is telling you the model looked
   * for the exit, not that it took it.
   */
  configEdit: boolean;
  tokens: number;
}

export interface Aggregate {
  target: string;
  arm: "A" | "B";
  runs: number;
  fixedRate: number;
  meanTurns: number;
  falseStartRate: number;
  /**
   * Share of runs that edited a declared consumer site. `null` when the target
   * declares no consumer route — an empty `consumerFiles` and "the agent never
   * took a route that does not exist" are different statements, and a 0 % in
   * this column would conflate them.
   */
  consumerRouteRate: number | null;
  /** Share of runs that attempted a refused config write — see `RunResult.configEdit`. */
  configEditRate: number;
  meanTokens: number;
}

export function aggregate(results: readonly RunResult[]): Aggregate[] {
  const groups = new Map<string, RunResult[]>();
  for (const result of results) {
    const key = `${result.target} ${result.arm}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(result);
    else groups.set(key, [result]);
  }

  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  const rows: Aggregate[] = [];
  for (const runs of groups.values()) {
    const first = runs[0];
    if (!first) continue;
    rows.push({
      target: first.target,
      arm: first.arm,
      runs: runs.length,
      fixedRate: mean(runs.map((r) => (r.fixed ? 1 : 0))),
      meanTurns: mean(runs.map((r) => r.turns)),
      falseStartRate: mean(runs.map((r) => (r.falseStart ? 1 : 0))),
      consumerRouteRate: first.consumerRouteDeclared
        ? mean(runs.map((r) => (r.consumerRoute ? 1 : 0)))
        : null,
      configEditRate: mean(runs.map((r) => (r.configEdit ? 1 : 0))),
      meanTokens: mean(runs.map((r) => r.tokens)),
    });
  }
  return rows;
}

/** A GitHub-flavoured markdown table, ready to paste into EVAL.md. */
export function toTable(rows: readonly Aggregate[]): string {
  const header =
    "| target | arm | runs | fixed | turns | false-start | consumer route | config attempt | ~tokens |\n" +
    "|---|---|---:|---:|---:|---:|---:|---:|---:|";
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  // "—" and "0%" are different findings: the first says the fixture offers no
  // consumer route, the second that it offers one and the model declined it.
  const body = rows.map(
    (r) =>
      `| ${r.target} | ${r.arm} | ${r.runs} | ${pct(r.fixedRate)} | ${r.meanTurns.toFixed(1)} | ${pct(
        r.falseStartRate,
      )} | ${r.consumerRouteRate === null ? "—" : pct(r.consumerRouteRate)} | ${
        // Loud on purpose: non-zero means the model went looking for the exit on
        // this row, which is worth knowing even though the exit is now closed.
        r.configEditRate > 0 ? `⚠ ${pct(r.configEditRate)}` : "0%"
      } | ${Math.round(r.meanTokens)} |`,
  );
  return [header, ...body].join("\n");
}
