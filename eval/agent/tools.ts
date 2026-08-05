/**
 * The three tools the model arm is given, and their sandboxed executor.
 *
 * All three are confined to one sandbox root. `write_file` records every path it
 * is asked to write — that record IS the false-start metric (an edit to a file
 * outside the fixture's known root-cause set), the core of H1. `run_typecheck`
 * spawns the repo's own `tsc` (the same compiler the fixtures are verified
 * under) so "green" means exactly what `tsc --noEmit` means to the user.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

/** Tool definitions, in the Messages API `tools` shape. Identical across both arms. */
export const TOOLS = [
  {
    name: "read_file",
    description: "Read a UTF-8 text file from the project. `path` is relative to the project root.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string", description: "Path relative to the project root." } },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    name: "write_file",
    description:
      "Write (create or overwrite) a UTF-8 text file. `path` is relative to the project root; `content` replaces the whole file.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path relative to the project root." },
        content: { type: "string", description: "The full new contents of the file." },
      },
      required: ["path", "content"],
      additionalProperties: false,
    },
  },
  {
    name: "run_typecheck",
    description:
      "Run `tsc --noEmit` on the project and return the diagnostics. Use this to check whether the project compiles cleanly.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
] as const;

export interface ToolContext {
  /** The sandbox root every path is resolved against. */
  root: string;
  /** Absolute path to the repo's `tsc.js`, spawned for `run_typecheck`. */
  tscPath: string;
  /** Every project-relative path `write_file` actually wrote, in order. */
  writes: string[];
  /**
   * Every project-relative path `write_file` **refused** — a TypeScript
   * configuration file, see `isCompilerConfig`. Kept apart from `writes`
   * because the false-start metric counts edits that happened; this counts
   * edits that were attempted and denied.
   */
  refusedWrites: string[];
}

/**
 * Does this path name a TypeScript configuration file?
 *
 * Measured on B3 (2026-08-04): both of `zod`'s completed runs reached green by
 * excluding the mutated file from `tsconfig.json` rather than by fixing the
 * rename. That run is scored `fixed`, edits no file outside the root cause, and
 * measures nothing about H1 — the cascade never gets read. A prompt sentence
 * would be a suggestion; this is a constraint, it is identical in both arms, and
 * it adds no text for the model to read before it acts.
 *
 * Deliberately wider than `tsconfig.json`: `hono`'s config extends
 * `tsconfig.base.json`, so narrowing the base would be the same escape one file
 * up.
 */
export function isCompilerConfig(relPath: string): boolean {
  const base = relPath.replaceAll("\\", "/").split("/").pop() ?? "";
  return /^tsconfig(\..+)?\.json$/.test(base);
}

/** Resolve a model-supplied path inside the sandbox, refusing anything that escapes it. */
function resolveInside(root: string, path: string): string {
  const abs = resolve(root, path);
  const rel = relative(root, abs);
  if (rel.startsWith("..") || resolve(root, rel) !== abs) {
    throw new Error(`path escapes the project root: ${path}`);
  }
  return abs;
}

/** Count diagnostics the way `eval/measure.ts` armA does, so the two agree on "green". */
export function typecheck(tscPath: string, root: string): { diagnostics: number; output: string } {
  const result = spawnSync(
    process.execPath,
    [tscPath, "-p", join(root, "tsconfig.json"), "--noEmit", "--pretty", "false"],
    { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const diagnostics = (output.match(/^\S.*: (error|warning) TS\d+: /gm) ?? []).length;
  return { diagnostics, output };
}

export interface ToolResult {
  text: string;
  isError: boolean;
}

/** Execute one tool call against the sandbox. Never throws — errors come back as `isError`. */
export function executeTool(name: string, input: unknown, ctx: ToolContext): ToolResult {
  try {
    const args = (input ?? {}) as { path?: string; content?: string };
    switch (name) {
      case "read_file": {
        const abs = resolveInside(ctx.root, args.path ?? "");
        if (!existsSync(abs)) return { text: `no such file: ${args.path}`, isError: true };
        return { text: readFileSync(abs, "utf8"), isError: false };
      }
      case "write_file": {
        const rel = args.path ?? "";
        const abs = resolveInside(ctx.root, rel);
        if (isCompilerConfig(rel)) {
          ctx.refusedWrites.push(rel.replaceAll("\\", "/"));
          return {
            text: `refused: ${rel} is the project's TypeScript configuration and is fixed for this task. Excluding a file from compilation is not a fix — change the source instead.`,
            isError: true,
          };
        }
        ctx.writes.push(rel.replaceAll("\\", "/"));
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, args.content ?? "", "utf8");
        return { text: `wrote ${rel}`, isError: false };
      }
      case "run_typecheck": {
        const { diagnostics, output } = typecheck(ctx.tscPath, ctx.root);
        if (diagnostics === 0)
          return { text: "0 errors — the project compiles cleanly.", isError: false };
        return { text: `${diagnostics} error(s):\n${output}`.trim(), isError: false };
      }
      default:
        return { text: `unknown tool: ${name}`, isError: true };
    }
  } catch (error) {
    return { text: (error as Error).message, isError: true };
  }
}
