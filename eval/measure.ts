/**
 * B0 — the deterministic measurement. No model, no API key, no dependency.
 *
 * Arm A is what the agent sees today: the raw output of the project's own
 * `tsc --noEmit --pretty false`. Arm B is tssift's `agent-text`. The published
 * primitive is the **character**, because anyone can reproduce it without
 * trusting our tokenizer, and because the A/B *ratio* — which is the actual
 * claim — is near enough tokenizer-independent. `chars / 4` is quoted as an
 * estimate with its divisor stated, never as a measurement.
 *
 * Read PROJECT.md §7 before reading the numbers. The composition below is the
 * one `run.ts` ships, and it has grown twice since the first table: P1 added
 * causality, which is what makes arm B smaller than arm A at all, and P2 added
 * enrichment, which makes it *larger* again by a stated amount. Both are in the
 * arm on purpose — the published ratio has to be the ratio of the shipped
 * product, not of a favourable subset of it.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CONTEXT_CAPTURE_CODES } from "../src/codes.js";
import { TssiftUnrunnable } from "../src/errors.js";
import { dedupe, detectCausality, enrich } from "../src/pipeline/index.js";
import { renderAgentText } from "../src/render/agent-text.js";
import { TsApiSource } from "../src/sources/ts-api.js";

/** Announced divisor for the token estimate. Stated everywhere the estimate appears. */
const CHARS_PER_TOKEN = 4;

interface Target {
  name: string;
  kind: "fixture" | "repo" | "corpus";
  project: string;
}

interface Arm {
  diagnostics: number;
  chars: number;
}

interface Row {
  target: Target;
  status: "ok" | "refused" | "missing";
  note?: string;
  typescript?: string;
  a?: Arm;
  b?: Arm;
}

/**
 * Walk up to the repository root. This file runs from `.eval-dist/eval/`, not
 * from `eval/`, so a fixed number of `..` is a trap that silently turns every
 * fixture into "path not found".
 */
function findRepoRoot(from: string): string {
  let dir = from;
  while (!existsSync(join(dir, "package.json"))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`no package.json above ${from}`);
    dir = parent;
  }
  return dir;
}

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)));

const TARGETS: Target[] = [
  {
    name: "partial-interface-rename",
    kind: "fixture",
    project: "fixtures/partial-interface-rename/before",
  },
  {
    name: "two-independent-roots",
    kind: "fixture",
    project: "fixtures/two-independent-roots/before",
  },
  { name: "overload-mismatch", kind: "fixture", project: "fixtures/overload-mismatch/before" },
  {
    name: "broken-barrel-export",
    kind: "fixture",
    project: "fixtures/broken-barrel-export/before",
  },
  { name: "arity-changed", kind: "fixture", project: "fixtures/arity-changed/before" },
  {
    name: "narrowed-union-member",
    kind: "fixture",
    project: "fixtures/narrowed-union-member/before",
  },
  { name: "nullable-chain", kind: "fixture", project: "fixtures/nullable-chain/before" },
  {
    name: "missing-required-property",
    kind: "fixture",
    project: "fixtures/missing-required-property/before",
  },
  {
    name: "assignability-mismatch",
    kind: "fixture",
    project: "fixtures/assignability-mismatch/before",
  },
  { name: "misspelled-property", kind: "fixture", project: "fixtures/misspelled-property/before" },
  {
    name: "unconstrained-generic",
    kind: "fixture",
    project: "fixtures/unconstrained-generic/before",
  },
  { name: "value-used-as-type", kind: "fixture", project: "fixtures/value-used-as-type/before" },
  {
    name: "wrong-tsconfig-paths",
    kind: "fixture",
    project: "fixtures/wrong-tsconfig-paths/before",
  },
  {
    name: "monorepo-cross-package",
    kind: "fixture",
    project: "fixtures/monorepo-cross-package/before",
  },
  {
    name: "phantom-dependency-pnpm",
    kind: "fixture",
    project: "fixtures/phantom-dependency-pnpm/before",
  },
  { name: "yarn-pnp-project", kind: "fixture", project: "fixtures/yarn-pnp-project/before" },
  {
    name: "missing-type-import",
    kind: "fixture",
    project: "fixtures/missing-type-import/before",
  },
  { name: "cannot-find-name", kind: "fixture", project: "fixtures/cannot-find-name/before" },
  {
    name: "missing-multiple-properties",
    kind: "fixture",
    project: "fixtures/missing-multiple-properties/before",
  },
  { name: "two-roots-one-file", kind: "fixture", project: "fixtures/two-roots-one-file/before" },
  {
    name: "missing-many-properties",
    kind: "fixture",
    project: "fixtures/missing-many-properties/before",
  },
  {
    name: "two-missing-names-one-file",
    kind: "fixture",
    project: "fixtures/two-missing-names-one-file/before",
  },
  {
    name: "namespace-import-rename",
    kind: "fixture",
    project: "fixtures/namespace-import-rename/before",
  },
  {
    name: "private-fields-and-anonymous-nullish",
    kind: "fixture",
    project: "fixtures/private-fields-and-anonymous-nullish/before",
  },
  // Real repositories. Paths are machine-specific by nature; a missing one is
  // reported as such rather than silently dropped.
  { name: "lekes", kind: "repo", project: `${homedir()}/projects/lekes` },
  { name: "tccp", kind: "repo", project: `${homedir()}/projects/tccp` },
  {
    name: "keyzia/data-explorer",
    kind: "repo",
    project: `${homedir()}/projects/nextp/keyzia/frontends/data-explorer`,
  },
  {
    name: "nextp/cursor-rules-hooks",
    kind: "repo",
    project: `${homedir()}/projects/nextp/dev-tools/cursor-rules/hooks`,
  },
];

/** A tracked working tree must come out of the measurement byte-identical. */
function gitState(dir: string): string | undefined {
  const result = spawnSync("git", ["status", "--porcelain"], { cwd: dir, encoding: "utf8" });
  return result.status === 0 ? result.stdout : undefined;
}

/**
 * Arm A: the project's own tsc, spawned rather than reimplemented, so the
 * baseline is literally the text the agent would read — summary line included.
 */
function armA(projectDir: string, configPath: string): Arm {
  const require = createRequire(join(projectDir, "anchor.cjs"));
  const tscPath = join(dirname(require.resolve("typescript")), "tsc.js");
  const buildInfoDir = mkdtempSync(join(tmpdir(), "tssift-eval-"));

  try {
    const result = spawnSync(
      process.execPath,
      [
        tscPath,
        "-p",
        configPath,
        "--noEmit",
        "--pretty",
        "false",
        // Keeps a project with `incremental` from dropping a .tsbuildinfo into
        // someone's real repository just because we measured it.
        "--incremental",
        "false",
        "--tsBuildInfoFile",
        join(buildInfoDir, "measure.tsbuildinfo"),
      ],
      { cwd: projectDir, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
    );

    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    const diagnostics = (output.match(/^\S.*: (error|warning) TS\d+: /gm) ?? []).length;
    return { diagnostics, chars: output.length };
  } finally {
    rmSync(buildInfoDir, { recursive: true, force: true });
  }
}

function armB(projectDir: string): { arm: Arm; typescript: string } {
  const { diagnostics, facts } = new TsApiSource().load({
    project: projectDir,
    captureFor: CONTEXT_CAPTURE_CODES,
  });
  // The same pipeline `run.ts` composes. Measuring the renderer without it would
  // measure a product nobody ships.
  const report = enrich(detectCausality(dedupe(diagnostics, facts), facts), facts);
  // The label `run.ts` passes, not the absolute directory. Passing the absolute
  // one — as this harness did until 2026-08-02 — put `/home/<user>/…` in the
  // one metric the project publishes: B chars grew with the length of whoever's
  // checkout path, so two machines measuring the same commit reported different
  // B/A ratios and neither matched the tool's actual output. Arm A was never
  // affected (tsc runs with `cwd: projectDir` and prints relative paths), so the
  // bug inflated exactly one side of the comparison.
  const rootLabel = relative(process.cwd(), facts.root) || ".";
  const text = renderAgentText({ report, facts, rootLabel, all: false });
  return {
    // `[n]` counts *entries*, not diagnostics: after P1 one entry can stand for
    // a whole cascade, and that difference is precisely what H1 claims. The
    // total the entries account for stays in `report.diagnostics`.
    arm: { diagnostics: (text.match(/^\[\d+\] /gm) ?? []).length, chars: text.length },
    typescript: facts.typescript.version,
  };
}

function measure(target: Target): Row {
  const projectDir = resolve(repoRoot, target.project);
  if (!existsSync(projectDir)) return { target, status: "missing", note: "path not found" };

  const configPath = join(projectDir, "tsconfig.json");
  if (!existsSync(configPath)) return { target, status: "missing", note: "no tsconfig.json" };

  const before = target.kind === "repo" ? gitState(projectDir) : undefined;

  let b: { arm: Arm; typescript: string };
  try {
    b = armB(projectDir);
  } catch (error) {
    if (error instanceof TssiftUnrunnable) {
      const first = error.message.split("\n").slice(0, 2).join(" ").trim();
      return { target, status: "refused", note: first };
    }
    throw error;
  }

  const a = armA(projectDir, configPath);

  const after = target.kind === "repo" ? gitState(projectDir) : undefined;
  const note = before !== undefined && before !== after ? "WORKING TREE CHANGED" : undefined;

  return { target, status: "ok", typescript: b.typescript, a, b: b.arm, ...(note ? { note } : {}) };
}

function ratio(b: number, a: number): string {
  if (a === 0) return "n/a";
  return `${((b / a) * 100).toFixed(0)}%`;
}

function estimate(chars: number): number {
  return Math.round(chars / CHARS_PER_TOKEN);
}

/**
 * The real broken corpus, when it has been materialised. Frozen at a pinned
 * commit and mutated deterministically, so unlike a live repository it cannot
 * move underneath the measurement. Build it with `bun run corpus:build`.
 */
function corpusTargets(): Target[] {
  const manifestPath = join(repoRoot, "eval", "corpus.json");
  if (!existsSync(manifestPath)) return [];
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    entries: Array<{ name: string; project?: string }>;
  };
  return manifest.entries
    .map((entry) => ({
      name: `corpus/${entry.name}`,
      kind: "corpus" as const,
      project: join(".corpus", entry.name, entry.project ?? "."),
    }))
    .filter((target) => existsSync(resolve(repoRoot, target.project)));
}

/**
 * The frozen, committed, anonymized corpus under `corpus/` — larger single-cause
 * cascades that, unlike the private materialised corpus, are in the repository:
 * they never move and need no private repo. Auto-discovered so any valid entry
 * is picked up.
 */
function committedCorpusTargets(): Target[] {
  const root = join(repoRoot, "corpus");
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((name) => existsSync(join(root, name, "before", "tsconfig.json")))
    .sort()
    .map((name) => ({
      name: `corpus/${name}`,
      kind: "corpus" as const,
      project: join("corpus", name, "before"),
    }));
}

const corpus = corpusTargets();
if (corpus.length === 0) {
  process.stderr.write(
    "note: the private corpus is not built — run `bun run corpus:build`. Measuring fixtures, committed corpus and live repos only.\n",
  );
}

const rows = [...TARGETS, ...committedCorpusTargets(), ...corpus].map(measure);

const lines: string[] = [];
lines.push(
  `| target | kind | ts | A diags | B diags | A chars | B chars | B/A chars | A ~tok | B ~tok |`,
);
lines.push(`|---|---|---|---:|---:|---:|---:|---:|---:|---:|`);

/**
 * Do the two arms agree that the project is broken at all?
 *
 * They must, because they read the same tsconfig with the same compiler. When
 * arm A reports zero diagnostics and arm B reports many, nothing has been
 * measured: A's `tsc` did not run over the same program — the case that produced
 * it is a **stale materialised corpus**, a copy under `.corpus/` whose source
 * repository has since disappeared, so its own `tsc` finds nothing to check
 * while `TsApiSource` still walks the tree.
 *
 * Folding such a row into the totals is worse than dropping it: on 2026-08-01 it
 * turned a published total into `B/A 1235%`, a number that describes a broken
 * copy and reads as a claim about the product. The frozen `corpus/` committed in
 * B1/T3 exists precisely so the corpus stops moving underneath the measurement;
 * this guard makes the failure of the *old* one loud instead of arithmetical.
 */
function isIncoherent(row: (typeof rows)[number]): boolean {
  return row.status === "ok" && row.a?.diagnostics === 0 && (row.b?.diagnostics ?? 0) > 0;
}

for (const row of rows) {
  if (isIncoherent(row)) {
    lines.push(
      `| ${row.target.name} | ${row.target.kind} | ${row.typescript} | ${row.a?.diagnostics} | ${row.b?.diagnostics} | incoherent — arm A type-checked nothing; excluded from totals | | | | |`,
    );
    continue;
  }
  if (row.status !== "ok" || !row.a || !row.b) {
    lines.push(
      `| ${row.target.name} | ${row.target.kind} | — | ${row.status} — ${row.note ?? ""} | | | | | | |`,
    );
    continue;
  }
  lines.push(
    `| ${row.target.name} | ${row.target.kind} | ${row.typescript} | ${row.a.diagnostics} | ${row.b.diagnostics} | ${row.a.chars} | ${row.b.chars} | ${ratio(row.b.chars, row.a.chars)} | ${estimate(row.a.chars)} | ${estimate(row.b.chars)} |`,
  );
}

const ok = rows.filter((row) => row.status === "ok" && row.a && row.b && !isIncoherent(row));
const incoherent = rows.filter(isIncoherent);
const totalA = ok.reduce((sum, row) => sum + (row.a?.chars ?? 0), 0);
const totalB = ok.reduce((sum, row) => sum + (row.b?.chars ?? 0), 0);
const diagsA = ok.reduce((sum, row) => sum + (row.a?.diagnostics ?? 0), 0);
const diagsB = ok.reduce((sum, row) => sum + (row.b?.diagnostics ?? 0), 0);

process.stdout.write(`${lines.join("\n")}\n\n`);
process.stdout.write(
  `Totals over ${ok.length} measured targets: diagnostics A=${diagsA} B=${diagsB}, ` +
    `chars A=${totalA} B=${totalB} (B/A ${ratio(totalB, totalA)}). ` +
    `Token estimates use chars / ${CHARS_PER_TOKEN}.\n`,
);

if (incoherent.length > 0) {
  process.stdout.write(
    `\nEXCLUDED as incoherent (arm A found 0 diagnostics, arm B found some): ${incoherent
      .map((row) => row.target.name)
      .join(", ")}.\n` +
      `Both arms read the same tsconfig with the same compiler, so this is not a\n` +
      `result — it is a target that no longer type-checks the program it used to.\n` +
      `The usual cause is a stale .corpus/ copy whose source repository is gone;\n` +
      `rebuild it with \`bun run corpus:build\` or delete it. The committed corpus/\n` +
      `is unaffected by design.\n`,
  );
}

const dirty = rows.filter((row) => row.note === "WORKING TREE CHANGED");
if (dirty.length > 0) {
  process.stdout.write(
    `\nWARNING: the working tree changed while measuring: ${dirty
      .map((row) => row.target.name)
      .join(", ")}.\n` +
      `This guard cannot tell "we wrote something" from "someone else edited the repo\n` +
      `mid-run". Check with: git -C <repo> status --porcelain, and re-run in isolation.\n` +
      `A repository under active work is not a usable measurement target either way —\n` +
      `its numbers are a snapshot of a moving object.\n`,
  );
  process.exitCode = 1;
}
