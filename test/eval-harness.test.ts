/**
 * Guards on the model arm's sandbox tools.
 *
 * The harness is not shipped, but it produces every number in EVAL.md, so a
 * silent change to what it permits is a silent change to what the numbers mean.
 * B3 measured the case this file exists for: on `zod`, both completed runs
 * reached `0 errors` by dropping the mutated file out of `tsconfig.json`, and
 * both were scored `fixed` — a fix rate computed over runs that never read the
 * cascade. The write is refused since 2026-08-05.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { executeTool, isCompilerConfig, type ToolContext } from "../eval/agent/tools.js";

let root: string;
let ctx: ToolContext;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "tssift-harness-"));
  ctx = { root, tscPath: join(root, "unused-tsc.js"), writes: [], refusedWrites: [] };
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("isCompilerConfig", () => {
  it("names every config file a run could widen to escape the task", () => {
    // `hono`'s harness-written config extends tsconfig.base.json, so narrowing
    // the base is the same escape one file up. Nested packages are the same
    // escape one directory down.
    for (const path of [
      "tsconfig.json",
      "tsconfig.base.json",
      "tsconfig.build.json",
      "packages/zod/tsconfig.json",
      "packages\\zod\\tsconfig.json",
    ]) {
      expect(isCompilerConfig(path), path).toBe(true);
    }
  });

  it("does not catch source files that merely mention the name", () => {
    for (const path of [
      "src/tsconfig.ts",
      "src/read-tsconfig-json.ts",
      "tsconfig.json.ts",
      "package.json",
      "src/index.ts",
    ]) {
      expect(isCompilerConfig(path), path).toBe(false);
    }
  });
});

describe("write_file", () => {
  it("refuses a config write, leaves the file untouched, and records the attempt", () => {
    const config = join(root, "tsconfig.json");
    writeFileSync(config, '{"include":["src"]}', "utf8");

    const result = executeTool(
      "write_file",
      { path: "tsconfig.json", content: '{"include":[]}' },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(readFileSync(config, "utf8")).toBe('{"include":["src"]}');
    // Kept out of `writes`: the false-start rate counts edits that happened.
    expect(ctx.writes).toEqual([]);
    expect(ctx.refusedWrites).toEqual(["tsconfig.json"]);
  });

  it("still writes ordinary source files", () => {
    const result = executeTool(
      "write_file",
      { path: "src/util.ts", content: "export const x = 1;\n" },
      ctx,
    );

    expect(result.isError).toBe(false);
    expect(readFileSync(join(root, "src/util.ts"), "utf8")).toBe("export const x = 1;\n");
    expect(ctx.writes).toEqual(["src/util.ts"]);
    expect(ctx.refusedWrites).toEqual([]);
  });

  it("refuses a path that escapes the sandbox", () => {
    const result = executeTool("write_file", { path: "../outside.ts", content: "x" }, ctx);

    expect(result.isError).toBe(true);
    expect(ctx.writes).toEqual([]);
  });
});
