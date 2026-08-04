/**
 * B1 — the model arm. For each target, two arms (A = raw `tsc --noEmit`, B =
 * tssift's `agent-text`) share one fixed system prompt and turn cap; the ONLY
 * difference is the initial diagnostic framing. Each arm runs n times on a fresh
 * sandbox copy, and the four §7 metrics fall straight out of the loop.
 *
 * Drives an OpenAI-compatible Chat Completions endpoint:
 *
 *   OPENAI_API_KEY=…  mise exec -- bun run eval:agent
 *   OPENAI_BASE_URL=http://localhost:1234/v1  AGENT_MODEL=…  mise exec -- bun run eval:agent
 *
 * Env knobs: OPENAI_BASE_URL (default https://api.openai.com/v1), OPENAI_API_KEY
 * (required unless a custom base URL is set — local servers often need none),
 * AGENT_MODEL (default gpt-4o-mini), AGENT_N (runs per arm, default 5),
 * AGENT_MAX_TURNS (default 12), AGENT_SMOKE=1 (one fixture, n=1 — a cheap loop
 * check before the sweep), AGENT_TARGETS=a,b,c (restrict to named targets),
 * AGENT_TEMPERATURE (default 1 since 2026-08-04; see model.ts for why it is no
 * longer 0, and what that costs in comparability with B1/B2).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { run as tssiftRun } from "../../src/run.js";
import { aggregate, type RunResult, toTable } from "./metrics.js";
import { type ModelEndpoint, runAgent, TEMPERATURE } from "./model.js";
import { makeSandbox } from "./sandbox.js";
import { executeTool, TOOLS, type ToolContext, typecheck } from "./tools.js";

const SYSTEM = `You are fixing TypeScript compilation errors in a small project that does not currently pass \`tsc --noEmit\`.

You have three tools:
- read_file(path): read a file. Paths are relative to the project root.
- write_file(path, content): create or overwrite a file with new contents.
- run_typecheck(): run \`tsc --noEmit\` and see the remaining errors.

Make the project compile cleanly. Change only what is necessary — do not refactor or reformat unrelated code. Call run_typecheck to verify, and keep going until it reports 0 errors. When it does, end your turn with a one-line summary of what you changed.`;

/** Identical wrapper for both arms; only `diagnostics` differs (raw tsc vs tssift). */
function initialUser(diagnostics: string): string {
  return `Here are the project's TypeScript errors:\n\n${diagnostics.trim()}\n\nFix the project so it compiles cleanly. Begin by reading the files involved.`;
}

function findRepoRoot(from: string): string {
  let dir = from;
  while (!existsSync(join(dir, "package.json"))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`no package.json above ${from}`);
    dir = parent;
  }
  return dir;
}

interface Target {
  name: string;
  before: string;
  /** Paths the declaration-side fix touches. */
  rootCauseFiles: string[];
  /**
   * Sites the fixture's own `expectedFix` accepts as an alternative, wider
   * route — patch every consumer instead of the one declaration. Writing here
   * is scored in its own column, never as a false start (metrics.ts). Absent or
   * empty means the fixture declares no such route, and every write outside
   * `rootCauseFiles` is a false start, as before.
   */
  consumerFiles: string[];
}

/** Shared shape of the ground truth both target sets read out of `meta.json`. */
interface GroundTruth {
  rootCauseFiles?: string[];
  consumerFiles?: string[];
}

function readConsumerFiles(meta: GroundTruth, where: string): string[] {
  if (meta.consumerFiles === undefined) return [];
  if (!Array.isArray(meta.consumerFiles)) {
    throw new Error(`${where}/meta.json has a non-array consumerFiles`);
  }
  return meta.consumerFiles;
}

function fixtureTargets(repoRoot: string): Target[] {
  const root = join(repoRoot, "fixtures");
  return readdirSync(root)
    .filter((name) => existsSync(join(root, name, "before", "tsconfig.json")))
    .sort()
    .map((name) => {
      const meta = JSON.parse(readFileSync(join(root, name, "meta.json"), "utf8")) as GroundTruth;
      // An empty array is valid — yarn-pnp-project has no bug, so any write is a
      // false start. Only a genuinely absent field is the T4 prerequisite error.
      if (!Array.isArray(meta.rootCauseFiles)) {
        throw new Error(`fixtures/${name}/meta.json is missing rootCauseFiles (T4 prerequisite)`);
      }
      return {
        name,
        before: join(root, name, "before"),
        rootCauseFiles: meta.rootCauseFiles,
        consumerFiles: readConsumerFiles(meta, `fixtures/${name}`),
      };
    });
}

/** The frozen, committed, anonymized corpus under `corpus/` — auto-discovered, ground truth from each meta.json. */
function committedCorpusTargets(repoRoot: string): Target[] {
  const root = join(repoRoot, "corpus");
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((name) => existsSync(join(root, name, "before", "tsconfig.json")))
    .sort()
    .map((name) => {
      const meta = JSON.parse(readFileSync(join(root, name, "meta.json"), "utf8")) as GroundTruth;
      if (!Array.isArray(meta.rootCauseFiles)) {
        throw new Error(`corpus/${name}/meta.json is missing rootCauseFiles`);
      }
      return {
        name: `corpus/${name}`,
        before: join(root, name, "before"),
        rootCauseFiles: meta.rootCauseFiles,
        consumerFiles: readConsumerFiles(meta, `corpus/${name}`),
      };
    });
}

function corpusTargets(repoRoot: string): Target[] {
  const manifest = join(repoRoot, "eval", "corpus.json");
  if (!existsSync(manifest)) return [];
  const { entries } = JSON.parse(readFileSync(manifest, "utf8")) as {
    entries: Array<{ name: string; project?: string; rootCauseFile: string }>;
  };
  return entries
    .map((entry) => ({
      name: `corpus/${entry.name}`,
      before: join(repoRoot, ".corpus", entry.name, entry.project ?? "."),
      rootCauseFiles: [entry.rootCauseFile],
      // The private manifest predates the consumer-route split and names one
      // cause file per entry; it declares no alternative route.
      consumerFiles: [],
    }))
    .filter((target) => existsSync(target.before));
}

/** Arm B's framing is exactly what the shipped CLI prints — stdout on success, the refusal on exit 2. */
function tssiftText(sandboxDir: string): string {
  let out = "";
  let err = "";
  const code = tssiftRun(["--project", sandboxDir], {
    out: (t) => {
      out += t;
    },
    err: (t) => {
      err += t;
    },
  });
  return code === 2 ? err : out;
}

async function main(): Promise<void> {
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const apiKey = process.env.OPENAI_API_KEY;
  // A key is required for any remote host; only a localhost server may go
  // keyless. This catches an empty key against a hosted endpoint before the
  // sweep fires a doomed 401.
  const localHost = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/|$)/i.test(
    baseUrl,
  );
  if (!apiKey && !localHost) {
    process.stderr.write(
      "Cannot run the model arm: OPENAI_API_KEY is empty for a remote endpoint.\n" +
        `  base URL: ${baseUrl}\n` +
        "  set OPENAI_API_KEY (in .env or the environment), or point OPENAI_BASE_URL at a local server, and re-run.\n",
    );
    process.exitCode = 2;
    return;
  }

  const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)));
  const require = createRequire(join(repoRoot, "anchor.cjs"));
  const tsMain = require.resolve("typescript");
  const tscPath = join(dirname(tsMain), "tsc.js");
  const typescriptDir = dirname(dirname(tsMain));

  const endpoint: ModelEndpoint = {
    baseUrl,
    apiKey,
    model: process.env.AGENT_MODEL ?? "gpt-4o-mini",
  };
  const maxTurns = Number(process.env.AGENT_MAX_TURNS) || 12;
  const smoke = process.env.AGENT_SMOKE === "1";
  const n = smoke ? 1 : Number(process.env.AGENT_N) || 5;

  let targets = [
    ...fixtureTargets(repoRoot),
    ...committedCorpusTargets(repoRoot),
    ...corpusTargets(repoRoot),
  ];
  if (process.env.AGENT_TARGETS) {
    const wanted = new Set(process.env.AGENT_TARGETS.split(",").map((s) => s.trim()));
    targets = targets.filter((t) => wanted.has(t.name));
  } else if (smoke) {
    targets = targets.filter((t) => t.name === "partial-interface-rename");
  }

  // Temperature travels with the banner because it is no longer a constant, and
  // a campaign's numbers mean different things at 0 and at 1 (see model.ts).
  process.stderr.write(
    `Model arm: ${endpoint.model} @ ${endpoint.baseUrl}, temperature ${TEMPERATURE}, ` +
      `${targets.length} targets × 2 arms × ${n} = ${targets.length * 2 * n} runs\n`,
  );

  const results: RunResult[] = [];
  for (const target of targets) {
    const allowed = new Set(target.rootCauseFiles);
    const consumers = new Set(target.consumerFiles);
    for (const arm of ["A", "B"] as const) {
      for (let i = 0; i < n; i += 1) {
        const sandbox = makeSandbox(target.before, typescriptDir);
        try {
          const diagnostics =
            arm === "A" ? typecheck(tscPath, sandbox.dir).output : tssiftText(sandbox.dir);
          const ctx: ToolContext = { root: sandbox.dir, tscPath, writes: [] };
          const runInfo = await runAgent({
            endpoint,
            system: SYSTEM,
            initialUser: initialUser(diagnostics),
            tools: TOOLS,
            executeTool: (name, input) => executeTool(name, input, ctx),
            maxTurns,
          });
          const written = [...new Set(ctx.writes)];
          const consumerWrites = written.filter((p) => consumers.has(p));
          const strayFiles = written.filter((p) => !allowed.has(p) && !consumers.has(p));
          const result: RunResult = {
            target: target.name,
            arm,
            fixed: typecheck(tscPath, sandbox.dir).diagnostics === 0,
            turns: runInfo.turns,
            falseStart: strayFiles.length > 0,
            strayFiles,
            consumerRoute: consumerWrites.length > 0,
            consumerWrites,
            consumerRouteDeclared: consumers.size > 0,
            tokens: runInfo.tokens,
          };
          results.push(result);
          process.stderr.write(
            `  ${target.name} ${arm} #${i + 1}: ${result.fixed ? "fixed" : "unfixed"}, ${runInfo.turns} turns${strayFiles.length ? `, stray: ${strayFiles.join(", ")}` : ""}${consumerWrites.length ? `, consumer route: ${consumerWrites.length} site(s)` : ""}\n`,
          );
        } finally {
          sandbox.cleanup();
        }
      }
    }
  }

  process.stdout.write(`\n${toTable(aggregate(results))}\n`);
}

main().catch((error) => {
  process.stderr.write(`${(error as Error).stack ?? String(error)}\n`);
  process.exitCode = 1;
});
