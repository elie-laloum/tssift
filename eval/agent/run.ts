/**
 * B1 — the model arm. For each target, two arms (A = raw `tsc --noEmit`, B =
 * tssift's `agent-text`) share one fixed system prompt and turn cap; the ONLY
 * difference is the initial diagnostic framing. Each arm runs n times on a fresh
 * sandbox copy, and the four §7 metrics fall straight out of the loop.
 *
 *   ANTHROPIC_API_KEY=…  mise exec -- bun run eval:agent
 *
 * Env knobs: AGENT_N (runs per arm, default 5), AGENT_MODEL, AGENT_MAX_TURNS,
 * AGENT_SMOKE=1 (one fixture, n=1 — a free-ish loop check before the sweep),
 * AGENT_TARGETS=a,b,c (restrict to named targets).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { run as tssiftRun } from "../../src/run.js";
import { runAgent } from "./anthropic.js";
import { aggregate, type RunResult, toTable } from "./metrics.js";
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
  /** Paths a correct fix may touch; a write outside this set is a false start. */
  rootCauseFiles: string[];
}

function fixtureTargets(repoRoot: string): Target[] {
  const root = join(repoRoot, "fixtures");
  return readdirSync(root)
    .filter((name) => existsSync(join(root, name, "before", "tsconfig.json")))
    .sort()
    .map((name) => {
      const meta = JSON.parse(readFileSync(join(root, name, "meta.json"), "utf8")) as {
        rootCauseFiles?: string[];
      };
      if (!meta.rootCauseFiles?.length) {
        throw new Error(`fixtures/${name}/meta.json is missing rootCauseFiles (T4 prerequisite)`);
      }
      return { name, before: join(root, name, "before"), rootCauseFiles: meta.rootCauseFiles };
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
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    process.stderr.write(
      "Cannot run the model arm: ANTHROPIC_API_KEY is not set.\n" +
        "  looked for: process.env.ANTHROPIC_API_KEY\n" +
        "  this arm makes paid Anthropic Messages API calls; export the key and re-run.\n",
    );
    process.exitCode = 2;
    return;
  }

  const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)));
  const require = createRequire(join(repoRoot, "anchor.cjs"));
  const tsMain = require.resolve("typescript");
  const tscPath = join(dirname(tsMain), "tsc.js");
  const typescriptDir = dirname(dirname(tsMain));

  const model = process.env.AGENT_MODEL ?? "claude-sonnet-4-5";
  const maxTurns = Number(process.env.AGENT_MAX_TURNS) || 12;
  const smoke = process.env.AGENT_SMOKE === "1";
  const n = smoke ? 1 : Number(process.env.AGENT_N) || 5;

  let targets = [...fixtureTargets(repoRoot), ...corpusTargets(repoRoot)];
  if (process.env.AGENT_TARGETS) {
    const wanted = new Set(process.env.AGENT_TARGETS.split(",").map((s) => s.trim()));
    targets = targets.filter((t) => wanted.has(t.name));
  } else if (smoke) {
    targets = targets.filter((t) => t.name === "partial-interface-rename");
  }

  process.stderr.write(
    `Model arm: ${model}, ${targets.length} targets × 2 arms × ${n} = ${targets.length * 2 * n} runs\n`,
  );

  const results: RunResult[] = [];
  for (const target of targets) {
    const allowed = new Set(target.rootCauseFiles);
    for (const arm of ["A", "B"] as const) {
      for (let i = 0; i < n; i += 1) {
        const sandbox = makeSandbox(target.before, typescriptDir);
        try {
          const diagnostics =
            arm === "A" ? typecheck(tscPath, sandbox.dir).output : tssiftText(sandbox.dir);
          const ctx: ToolContext = { root: sandbox.dir, tscPath, writes: [] };
          const runInfo = await runAgent({
            apiKey,
            model,
            system: SYSTEM,
            initialUser: initialUser(diagnostics),
            tools: TOOLS,
            executeTool: (name, input) => executeTool(name, input, ctx),
            maxTurns,
          });
          const strayFiles = [...new Set(ctx.writes.filter((p) => !allowed.has(p)))];
          const result: RunResult = {
            target: target.name,
            arm,
            fixed: typecheck(tscPath, sandbox.dir).diagnostics === 0,
            turns: runInfo.turns,
            falseStart: strayFiles.length > 0,
            strayFiles,
            tokens: runInfo.tokens,
          };
          results.push(result);
          process.stderr.write(
            `  ${target.name} ${arm} #${i + 1}: ${result.fixed ? "fixed" : "unfixed"}, ${runInfo.turns} turns${strayFiles.length ? `, stray: ${strayFiles.join(", ")}` : ""}\n`,
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
