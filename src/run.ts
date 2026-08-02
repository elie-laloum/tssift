import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { CONTEXT_CAPTURE_CODES } from "./codes.js";
import { TssiftUnrunnable } from "./errors.js";
import { dedupe, detectCausality, enrich } from "./pipeline/index.js";
import { renderAgentText } from "./render/agent-text.js";
import { countErrors, isRenderFormat, RENDER_FORMATS, type RenderFormat } from "./render/index.js";
import { renderJson } from "./render/json.js";
import { TsApiSource } from "./sources/ts-api.js";

/** The two names Yarn writes its resolution map to; the newer one first. */
const PNP_MANIFESTS = [".pnp.cjs", ".pnp.js"] as const;

/** The manifest present at `root`, if any — the declarative signal of a PnP project (no subprocess, rule 10). */
function pnpManifestAt(root: string): string | undefined {
  return PNP_MANIFESTS.map((name) => join(root, name)).find((path) => existsSync(path));
}

/**
 * Is this a Yarn PnP project being read by a bare Node process?
 *
 * A `.pnp.cjs` at the project root with `process.versions.pnp` unset means the
 * compiler never loaded the resolution map, so every unresolved import is a
 * false negative rather than a real error — the most expensive failure mode for
 * a tool whose whole argument is "trust the hierarchy" (EVAL.md § yarn-pnp).
 *
 * Gated on an actual TS2307 in the report, deliberately: a PnP project with only
 * genuine type errors runs fine, and the refusal fires only when the misread
 * would actually mislead. This is a run-layer guard, never in the source — the
 * library and the eval still fold `yarn-pnp-project`, so the 2307 rule stays
 * measured; only the shipped CLI refuses (§15).
 */
export function isPnpMisread(
  root: string,
  hasPnpRuntime: boolean,
  codes: readonly number[],
): boolean {
  return !hasPnpRuntime && codes.includes(2307) && pnpManifestAt(root) !== undefined;
}

export const USAGE = `tssift — groups tsc diagnostics for an agent, and never says what to fix.

Usage:
  tssift [--project <tsconfig.json>] [--format agent-text|json] [--all]
         [--budget-tokens <n>]

Options:
  --project <path>   tsconfig, or a directory holding one. Default ./tsconfig.json.
                     Taken as given: no upward search.
  --format <name>    agent-text (default) or json. json is the complete report.
  --all              restore every diagnostic in full, ungrouped. Ignores
                     --budget-tokens: the two express opposite intents and --all
                     wins.
  --budget-tokens <n>
                     cap the agent-text report at about n tokens, estimated as
                     characters / 4. Groups shed usage-site lines first, then
                     the lowest-ranked entries become a counter. A root is never
                     truncated, so a budget too small for the first entry is
                     exceeded rather than obeyed. json is never budgeted.
  --help             print this and exit.

Exit codes:
  0  no error diagnostics
  1  the project has type errors
  2  tssift could not run`;

export interface Streams {
  out(text: string): void;
  err(text: string): void;
}

export interface CliOptions {
  project: string;
  format: RenderFormat;
  all: boolean;
  help: boolean;
  budgetTokens?: number;
}

export function parseArgs(argv: readonly string[]): CliOptions {
  const options: CliOptions = {
    project: "./tsconfig.json",
    format: "agent-text",
    all: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    switch (arg) {
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--all":
        options.all = true;
        break;
      case "--project": {
        const value = argv[++index];
        if (value === undefined) throw new TssiftUnrunnable("--project needs a path.");
        options.project = value;
        break;
      }
      case "--format": {
        const value = argv[++index];
        if (value === undefined) throw new TssiftUnrunnable("--format needs a value.");
        if (!isRenderFormat(value)) {
          throw new TssiftUnrunnable(
            `Unknown --format "${value}". Known formats: ${RENDER_FORMATS.join(", ")}.`,
          );
        }
        options.format = value;
        break;
      }
      case "--budget-tokens": {
        const value = argv[++index];
        if (value === undefined) throw new TssiftUnrunnable("--budget-tokens needs a number.");
        // Strict: a budget silently read as NaN would disable the very
        // constraint the caller asked for, which is the silent fallback rule 15
        // forbids. `Number()` alone would accept "1e3", " 12 " and "0x40".
        if (!/^[1-9]\d*$/.test(value)) {
          throw new TssiftUnrunnable(
            `--budget-tokens takes a positive whole number of tokens, got "${value}".`,
          );
        }
        options.budgetTokens = Number(value);
        break;
      }
      default:
        // No silent fallback, and no guessing at intent (rule 15).
        throw new TssiftUnrunnable(`Unknown argument "${arg}".\n\n${USAGE}`);
    }
  }

  return options;
}

/**
 * The whole CLI, minus the process. Returns the exit code instead of setting
 * it, so the behaviour is testable without spawning anything and without a
 * module-level side effect.
 *
 * The report goes to stdout; tssift's own failures go to stderr and nothing
 * else does. An agent tells "your code is broken" from "my invocation is
 * broken" by the exit code alone (PROJECT.md §9).
 */
export function run(argv: readonly string[], streams: Streams): number {
  let options: CliOptions;
  try {
    options = parseArgs(argv);
  } catch (error) {
    streams.err(`${(error as Error).message}\n`);
    return 2;
  }

  if (options.help) {
    streams.out(`${USAGE}\n`);
    return 0;
  }

  try {
    const { diagnostics: ingested, facts } = new TsApiSource().load({
      project: options.project,
      captureFor: CONTEXT_CAPTURE_CODES,
    });

    // The pipeline. Stages are pure and see no `typescript` (rule 4).
    //
    // `dedupe` runs even under `--all`: it removes only byte-identical copies,
    // which carry no information, so "restore everything" still restores
    // everything there is. `detectCausality` removes nothing at all — it returns
    // the complete table plus a ranked index over it, and `--all` decides only
    // whether the renderer walks that index (rule 2). `enrich` adds facts and
    // removes nothing either — it is the last stage because a fact must never
    // influence a grouping decision.
    const report = enrich(detectCausality(dedupe(ingested, facts), facts), facts);

    // A bare-Node read of a Yarn PnP project produces plausible, entirely false
    // TS2307s. Refusing beats rendering a clean-looking, wrong hierarchy (§15).
    const codes = report.diagnostics.map((diagnostic) => diagnostic.code);
    if (isPnpMisread(facts.root, Boolean(process.versions.pnp), codes)) {
      const manifest = pnpManifestAt(facts.root) ?? join(facts.root, PNP_MANIFESTS[0]);
      const unresolved = codes.filter((code) => code === 2307).length;
      throw new TssiftUnrunnable(
        [
          "Cannot analyse a Yarn PnP project from a bare Node process.",
          `  found: ${manifest}`,
          "  process.versions.pnp: undefined",
          `  ${unresolved} of the diagnostics are TS2307 "Cannot find module", which under Yarn`,
          "  PnP are resolution artefacts, not real errors: this process never loaded the",
          "  .pnp.cjs resolution map, so every unresolved import is a false negative.",
          "  run tssift through the PnP runtime instead: `yarn tssift …`",
        ].join("\n"),
      );
    }

    const input = {
      report,
      facts,
      rootLabel: relative(process.cwd(), facts.root) || ".",
      all: options.all,
      ...(options.budgetTokens === undefined ? {} : { budgetTokens: options.budgetTokens }),
    };

    streams.out(options.format === "json" ? renderJson(input) : renderAgentText(input));

    return countErrors(report.diagnostics) > 0 ? 1 : 0;
  } catch (error) {
    if (error instanceof TssiftUnrunnable) {
      streams.err(`${error.message}\n`);
      return 2;
    }
    // Anything unexpected is still a tssift failure, not a project failure.
    streams.err(`tssift failed unexpectedly: ${(error as Error).stack ?? String(error)}\n`);
    return 2;
  }
}
