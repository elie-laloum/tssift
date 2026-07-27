/**
 * P1 T1 — what selective context capture buys, and what it costs.
 *
 * Decision 28 of `.plans/2026-07-27_p1-causality.md`: every extension of
 * `CONTEXT_CAPTURE_CODES` is paid for in checker round-trips, so it is measured
 * before it is kept. This script reports, per target:
 *
 *   - the resolution rate per captured code (share carrying a `declaredAt`);
 *   - where those `declaredAt` point, so a cascade collapsing onto one
 *     declaration is visible rather than assumed;
 *   - wall-clock `TsApiSource.load` with capture off and on, best of N;
 *   - the size of the json report either way, since `memberNames` and
 *     `declaredAt.snippet` are not free.
 *
 * Run it with:  mise exec -- bun run capture:measure
 * It reads only; it never touches a measured project.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CONTEXT_CAPTURE_CODES } from "../.eval-dist/src/codes.js";
import { renderJson } from "../.eval-dist/src/render/json.js";
import { TsApiSource } from "../.eval-dist/src/sources/ts-api.js";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const RUNS = 3;

function targets() {
  const fixtures = ["partial-interface-rename", "two-independent-roots", "overload-mismatch"].map(
    (name) => ({ name, project: join(repoRoot, "fixtures", name, "before") }),
  );

  const manifestPath = join(repoRoot, "eval", "corpus.json");
  const corpus = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, "utf8")).entries.map((entry) => ({
        name: `corpus/${entry.name}`,
        project: join(repoRoot, ".corpus", entry.name, entry.project ?? "."),
      }))
    : [];

  return [...fixtures, ...corpus].filter((target) => existsSync(resolve(target.project)));
}

/** Best of N. The minimum is the run least polluted by GC and by the machine. */
function timeLoad(project, captureFor) {
  let best = Number.POSITIVE_INFINITY;
  let last;
  for (let run = 0; run < RUNS; run += 1) {
    const started = process.hrtime.bigint();
    last = new TsApiSource().load({ project, captureFor });
    const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
    if (elapsed < best) best = elapsed;
  }
  return { ms: best, result: last };
}

function jsonSize(result, project) {
  return renderJson({ ...result, rootLabel: project, all: false }).length;
}

for (const target of targets()) {
  const off = timeLoad(target.project, []);
  const on = timeLoad(target.project, CONTEXT_CAPTURE_CODES);

  const overhead = ((on.ms / off.ms - 1) * 100).toFixed(1);
  const sizeOff = jsonSize(off.result, target.name);
  const sizeOn = jsonSize(on.result, target.name);

  console.log(`\n=== ${target.name}`);
  console.log(
    `    load: ${off.ms.toFixed(0)} ms off → ${on.ms.toFixed(0)} ms on  (${overhead > 0 ? "+" : ""}${overhead} %)   ` +
      `json: ${sizeOff} → ${sizeOn} chars (${((sizeOn / sizeOff - 1) * 100).toFixed(0)} %)`,
  );

  const byCode = new Map();
  for (const diagnostic of on.result.diagnostics) {
    if (!CONTEXT_CAPTURE_CODES.includes(diagnostic.code)) continue;
    const bucket = byCode.get(diagnostic.code) ?? { total: 0, resolved: 0, sites: new Map() };
    bucket.total += 1;
    const ref = diagnostic.context?.subject ?? diagnostic.context?.expected;
    if (ref) {
      bucket.resolved += 1;
      const site = `${ref.declaredAt.file}:${ref.declaredAt.line}:${ref.declaredAt.column} (${ref.kind} ${ref.name})`;
      bucket.sites.set(site, (bucket.sites.get(site) ?? 0) + 1);
    }
    byCode.set(diagnostic.code, bucket);
  }

  for (const [code, bucket] of [...byCode.entries()].sort((a, b) => b[1].total - a[1].total)) {
    const rate = ((100 * bucket.resolved) / bucket.total).toFixed(0);
    console.log(`    TS${code}: ${bucket.resolved}/${bucket.total} resolved (${rate} %)`);
    for (const [site, count] of [...bucket.sites.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)) {
      console.log(`        ${count}× → ${site}`);
    }
  }
}
