/**
 * Rule 4 made testable.
 *
 * "A file under `pipeline/` that imports `typescript` breaks rule 4" is listed
 * in AGENTS.md as a warning sign, and a warning sign that only a reader can
 * raise is one that rots. The TS 7 Go port removed `ts.createProgram`; the whole
 * point of capturing everything at ingestion is that `Ts7ApiSource` can be
 * *added* rather than force a rewrite. A stray `import type * as TS` under
 * `pipeline/` quietly cancels that, and would cost nothing today and everything
 * on the day it matters.
 *
 * `import type` counts. It compiles away, but it is how the coupling starts:
 * once a stage is typed against a compiler node, the value import follows.
 */
import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("../src", import.meta.url));

async function filesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => join(entry.parentPath, entry.name));
}

describe("rule 4 · the pipeline never sees the compiler", () => {
  it("no file under src/pipeline/ imports typescript, not even as a type", async () => {
    const offenders: string[] = [];
    for (const file of await filesUnder(join(SRC, "pipeline"))) {
      const source = readFileSync(file, "utf8");
      if (
        /\bfrom\s+["']typescript["']/.test(source) ||
        /\brequire\(["']typescript["']\)/.test(source)
      ) {
        offenders.push(file.slice(SRC.length + 1));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("only src/sources/ imports typescript at all", async () => {
    const importers: string[] = [];
    for (const file of await filesUnder(SRC)) {
      const source = readFileSync(file, "utf8");
      if (/\bfrom\s+["']typescript["']/.test(source)) importers.push(file.slice(SRC.length + 1));
    }
    // Sorted so the failure message names the intruder rather than a diff of
    // two unordered lists.
    expect(importers.sort()).toEqual(["sources/context.ts", "sources/ts-api.ts"]);
  });

  it("src/types.ts imports nothing at all", () => {
    const source = readFileSync(join(SRC, "types.ts"), "utf8");
    expect(source).not.toMatch(/^\s*import\b/m);
  });
});
