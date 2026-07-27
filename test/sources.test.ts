import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { CONTEXT_CAPTURE_CODES } from "../src/codes.js";
import { TssiftUnrunnable } from "../src/errors.js";
import { TsApiSource } from "../src/sources/ts-api.js";

const fixture = (name: string): string =>
  fileURLToPath(new URL(`../fixtures/${name}/before`, import.meta.url));

const load = (name: string) =>
  new TsApiSource().load({ project: fixture(name), captureFor: CONTEXT_CAPTURE_CODES });

/**
 * Temporary projects live outside the repository on purpose: Node resolution
 * walks up, so a throwaway project created *inside* the repo would happily find
 * our own node_modules/typescript and the guard under test would pass for the
 * wrong reason.
 */
const scratchDirs: string[] = [];
function scratchProject(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "tssift-test-"));
  scratchDirs.push(dir);
  for (const [relative, contents] of Object.entries(files)) {
    const target = join(dir, relative);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, contents);
  }
  return dir;
}

/**
 * Makes `typescript` resolvable from a scratch project by symlinking our own
 * install into its `node_modules/`. A copy would cost 20 MB per test; a stub
 * `main` pointing at the real file would break `libDir`, which is derived from
 * the resolved path. Ubuntu-only CI and Windows out of scope for v0.1 (§9.2),
 * so a symlink is safe here.
 */
function linkTypeScript(projectDir: string): void {
  const real = dirname(createRequire(import.meta.url).resolve("typescript"));
  const modules = join(projectDir, "node_modules");
  mkdirSync(modules, { recursive: true });
  symlinkSync(join(real, ".."), join(modules, "typescript"), "dir");
}

afterAll(() => {
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true });
});

describe("TsApiSource · partial-interface-rename", () => {
  const { diagnostics, facts } = load("partial-interface-rename");

  it("reports the three contract codes", () => {
    expect(diagnostics.map((d) => d.code)).toEqual([2353, 2339, 2345]);
  });

  it("carries a chain and a related message on the 2345", () => {
    const argument = diagnostics.find((d) => d.code === 2345);
    expect(argument).toBeDefined();
    expect(argument?.chain.length).toBeGreaterThan(0);
    expect(argument?.chain[0]?.code).toBe(2741);
    expect(argument?.chain[0]?.depth).toBe(1);

    const related = argument?.related ?? [];
    expect(related.length).toBeGreaterThan(0);
    expect(related[0]?.message).toMatch(/'email' is declared here/);
    expect(related[0]?.span?.file).toBe("src/types/user.ts");
  });

  it("keeps the TS message raw", () => {
    const property = diagnostics.find((d) => d.code === 2339);
    expect(property?.message).toBe(
      "Property 'emailAddress' does not exist on type 'CreateUserInput'.",
    );
  });

  it("reports the compiler it actually loaded", () => {
    expect(facts.typescript.version).toMatch(/^5\.\d+\.\d+/);
    expect(facts.typescript.path).toMatch(/typescript/);
  });

  it("records module specifiers as written", () => {
    expect(facts.imports["src/api/user.ts"]).toEqual(["../types/user"]);
  });
});

describe("TsApiSource · path and position discipline", () => {
  for (const name of [
    "partial-interface-rename",
    "two-independent-roots",
    "overload-mismatch",
    "broken-barrel-export",
    "arity-changed",
    "narrowed-union-member",
    "nullable-chain",
    "missing-required-property",
    "assignability-mismatch",
    "misspelled-property",
    "unconstrained-generic",
    "value-used-as-type",
  ]) {
    it(`emits no absolute path and no backslash on ${name}`, () => {
      const { diagnostics, facts } = load(name);
      const paths = [
        ...diagnostics.map((d) => d.primary.file),
        ...diagnostics.flatMap((d) => d.related.map((r) => r.span?.file ?? "")),
        ...facts.files,
      ];
      for (const path of paths) {
        expect(path.startsWith("/")).toBe(false);
        expect(path).not.toMatch(/\\/);
        expect(path).not.toMatch(/^[A-Za-z]:/);
      }
    });

    it(`emits 1-indexed positions on ${name}`, () => {
      const { diagnostics } = load(name);
      for (const diagnostic of diagnostics) {
        expect(diagnostic.primary.line).toBeGreaterThanOrEqual(1);
        expect(diagnostic.primary.column).toBeGreaterThanOrEqual(1);
      }
    });
  }
});

describe("TsApiSource · determinism", () => {
  it("gives identical ids and order across runs", () => {
    const first = load("overload-mismatch").diagnostics;
    const second = load("overload-mismatch").diagnostics;
    expect(first.map((d) => d.id)).toEqual(second.map((d) => d.id));
    expect(first.map((d) => `${d.primary.file}:${d.primary.line}:${d.code}`)).toEqual(
      second.map((d) => `${d.primary.file}:${d.primary.line}:${d.code}`),
    );
  });

  it("gives 12 hex characters of id", () => {
    for (const diagnostic of load("two-independent-roots").diagnostics) {
      expect(diagnostic.id).toMatch(/^[0-9a-f]{12}$/);
    }
  });
});

describe("TsApiSource · branching message chain", () => {
  const { diagnostics } = load("overload-mismatch");
  const overload = diagnostics.find((d) => d.code === 2769);

  it("preserves depth across three sibling branches", () => {
    expect(overload).toBeDefined();
    expect(overload?.chain.map((node) => node.depth)).toEqual([1, 2, 1, 2, 1, 2]);
    expect(overload?.chain.filter((node) => node.depth === 1).map((node) => node.code)).toEqual([
      2772, 2772, 2772,
    ]);
  });

  it("keeps every related entry", () => {
    expect(overload?.related.length).toBe(3);
    for (const related of overload?.related ?? []) {
      expect(related.message.length).toBeGreaterThan(0);
    }
  });
});

describe("TsApiSource · exit-2 conditions (rule 15)", () => {
  it("refuses a TypeScript 7 project, naming version and path", () => {
    // Reproduces what a real typescript@7 install does, verified 2026-07-27:
    // require("typescript") succeeds, reports version 7.0.2, and exposes no
    // createProgram. Vendoring the real package would add ~20 MB for that fact.
    const project = scratchProject({
      "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true, noEmit: true } }),
      "index.ts": "export const x: number = 1;\n",
      "node_modules/typescript/package.json": JSON.stringify({
        name: "typescript",
        version: "7.0.2",
        main: "./index.cjs",
      }),
      "node_modules/typescript/index.cjs": 'module.exports = { version: "7.0.2" };\n',
    });

    let thrown: unknown;
    try {
      new TsApiSource().load({ project, captureFor: CONTEXT_CAPTURE_CODES });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(TssiftUnrunnable);
    const message = (thrown as Error).message;
    expect(message).toMatch(/Unsupported TypeScript version/);
    expect(message).toMatch(/typescript 7\.0\.2/);
    expect(message).toMatch(/node_modules\/typescript/);
    expect(message).toMatch(/>=5\.4 <6/);
  });

  it("refuses a project with no resolvable typescript, naming where it looked", () => {
    const project = scratchProject({
      "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true, noEmit: true } }),
      "index.ts": "export const x: number = 1;\n",
    });

    let thrown: unknown;
    try {
      new TsApiSource().load({ project, captureFor: CONTEXT_CAPTURE_CODES });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(TssiftUnrunnable);
    expect((thrown as Error).message).toMatch(/Cannot resolve "typescript"/);
    expect((thrown as Error).message).toContain(project);
  });

  it("refuses a solution tsconfig, naming the references to point at instead", () => {
    // `"files": []` + `"include": []` + `"references": [...]` is the monorepo
    // root shape. `tsc -p` type-checks nothing there and exits 0; printing that
    // zero would be a false clean over a whole repository (PROJECT.md §9).
    const project = scratchProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: { strict: true, noEmit: true },
        files: [],
        include: [],
        references: [{ path: "./apps/data-explorer" }, { path: "./apps/widget" }],
      }),
      "apps/data-explorer/tsconfig.json": JSON.stringify({
        compilerOptions: { strict: true, noEmit: true, composite: true },
      }),
      "apps/data-explorer/index.ts": "export const x: number = 1;\n",
      "apps/widget/tsconfig.json": JSON.stringify({
        compilerOptions: { strict: true, noEmit: true, composite: true },
      }),
      "apps/widget/index.ts": "export const y: number = 2;\n",
    });
    linkTypeScript(project);

    let thrown: unknown;
    try {
      new TsApiSource().load({ project, captureFor: CONTEXT_CAPTURE_CODES });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(TssiftUnrunnable);
    const message = (thrown as Error).message;
    expect(message).toMatch(/Nothing to type-check/);
    expect(message).toContain(join(project, "tsconfig.json"));
    expect(message).toMatch(/0 files matched, 2 project references declared/);
    expect(message).toContain("./apps/data-explorer");
    expect(message).toContain("./apps/widget");
  });

  it("does not hijack an empty project with no reference — TypeScript reports it", () => {
    // The mirror case, and it is NOT ours to refuse. Measured 2026-07-27 on
    // 5.9.3: the very same `"files": []` / `"include": []` shape yields TS18002
    // as a config-parsing diagnostic as soon as `references` is absent — that
    // is what makes `references` a sound discriminator rather than a guess.
    //
    // So this branch exits 1 with TypeScript's own wording, never a silent 0.
    // Throwing our own exit 2 here would replace a precise compiler message
    // with a vaguer one of ours.
    const project = scratchProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: { strict: true, noEmit: true },
        files: [],
        include: [],
      }),
    });
    linkTypeScript(project);

    const { diagnostics, facts } = new TsApiSource().load({
      project,
      captureFor: CONTEXT_CAPTURE_CODES,
    });
    expect(diagnostics.map((d) => d.code)).toEqual([18002]);
    expect(facts.files).toEqual([]);
  });

  it("refuses a missing tsconfig without searching upwards", () => {
    const project = join(scratchProject({ placeholder: "" }), "nope", "tsconfig.json");
    expect(() =>
      new TsApiSource().load({ project, captureFor: CONTEXT_CAPTURE_CODES }),
    ).toThrowError(TssiftUnrunnable);
  });
});
