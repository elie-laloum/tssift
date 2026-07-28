/**
 * The four B1 metrics (PROJECT.md §7), and how a set of runs rolls up.
 *
 * The load-bearing one is the **false start**: a `write_file` to a path outside
 * the fixture's known root-cause set. It is the direct test of H1 — a noisier
 * diagnostic sends the agent to edit the wrong file — and it is why the harness
 * intercepts `write_file` rather than reading a transcript after the fact.
 */
export interface RunResult {
  target: string;
  /** "A" (raw tsc) or "B" (tssift agent-text). */
  arm: "A" | "B";
  /** The project compiled cleanly at the end of the loop (first-try fix). */
  fixed: boolean;
  /** Assistant turns until the loop ended. */
  turns: number;
  /** At least one write landed outside the root-cause set. */
  falseStart: boolean;
  /** Distinct paths written that are outside the root-cause set. */
  strayFiles: string[];
  tokens: number;
}

export interface Aggregate {
  target: string;
  arm: "A" | "B";
  runs: number;
  fixedRate: number;
  meanTurns: number;
  falseStartRate: number;
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
      meanTokens: mean(runs.map((r) => r.tokens)),
    });
  }
  return rows;
}

/** A GitHub-flavoured markdown table, ready to paste into EVAL.md. */
export function toTable(rows: readonly Aggregate[]): string {
  const header =
    "| target | arm | runs | fixed | turns | false-start | ~tokens |\n" +
    "|---|---|---:|---:|---:|---:|---:|";
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const body = rows.map(
    (r) =>
      `| ${r.target} | ${r.arm} | ${r.runs} | ${pct(r.fixedRate)} | ${r.meanTurns.toFixed(1)} | ${pct(
        r.falseStartRate,
      )} | ${Math.round(r.meanTokens)} |`,
  );
  return [header, ...body].join("\n");
}
