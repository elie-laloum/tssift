import { describe, expect, it } from "vitest";
import {
  diagnosticId,
  isSupportedTypeScriptVersion,
  normalizeFilePath,
} from "../src/sources/ts-api.js";

/**
 * Unit coverage for the branches no fixture reaches. The three fixtures compile
 * with `skipLibCheck` and touch no dependency, so nothing in them ever produces
 * a diagnostic inside `<ts-lib>/` or `node_modules/` — yet those are precisely
 * the paths that kill a snapshot on someone else's machine when they leak.
 */

const ROOT = "/home/someone/projects/app";
const TS_LIB = "/home/someone/projects/app/node_modules/typescript/lib";

describe("normalizeFilePath", () => {
  it("makes a project file relative to the tsconfig directory", () => {
    expect(normalizeFilePath(`${ROOT}/src/api/user.ts`, ROOT, TS_LIB)).toBe("src/api/user.ts");
  });

  it("collapses the compiler's own lib directory to a sentinel", () => {
    expect(normalizeFilePath(`${TS_LIB}/lib.es5.d.ts`, ROOT, TS_LIB)).toBe("<ts-lib>/lib.es5.d.ts");
  });

  it("prefers the lib sentinel over node_modules, since lib sits inside it", () => {
    const normalized = normalizeFilePath(`${TS_LIB}/lib.es2022.d.ts`, ROOT, TS_LIB);
    expect(normalized).toBe("<ts-lib>/lib.es2022.d.ts");
    expect(normalized.startsWith("node_modules/")).toBe(false);
  });

  it("keeps a dependency path from the nearest package root", () => {
    expect(normalizeFilePath(`${ROOT}/node_modules/zod/index.d.ts`, ROOT, TS_LIB)).toBe(
      "node_modules/zod/index.d.ts",
    );
  });

  it("uses the last node_modules for a nested dependency", () => {
    expect(
      normalizeFilePath(`${ROOT}/node_modules/a/node_modules/b/index.d.ts`, ROOT, TS_LIB),
    ).toBe("node_modules/b/index.d.ts");
  });

  it("climbs out with ../ rather than leaking a home directory", () => {
    const normalized = normalizeFilePath("/home/someone/projects/shared/util.ts", ROOT, TS_LIB);
    expect(normalized).toBe("../shared/util.ts");
    expect(normalized).not.toContain("/home/");
  });

  it("emits POSIX separators", () => {
    expect(
      normalizeFilePath("C:\\work\\app\\src\\a.ts", "C:\\work\\app", "C:\\ts\\lib"),
    ).not.toMatch(/\\/);
  });
});

describe("diagnosticId", () => {
  it("is 12 hex characters", () => {
    expect(diagnosticId(2345, "src/a.ts", 1, 1, "msg")).toMatch(/^[0-9a-f]{12}$/);
  });

  it("is deterministic for identical input", () => {
    expect(diagnosticId(2345, "src/a.ts", 10, 5, "msg")).toBe(
      diagnosticId(2345, "src/a.ts", 10, 5, "msg"),
    );
  });

  it("changes when any component changes", () => {
    const base = diagnosticId(2345, "src/a.ts", 10, 5, "msg");
    expect(diagnosticId(2346, "src/a.ts", 10, 5, "msg")).not.toBe(base);
    expect(diagnosticId(2345, "src/b.ts", 10, 5, "msg")).not.toBe(base);
    expect(diagnosticId(2345, "src/a.ts", 11, 5, "msg")).not.toBe(base);
    expect(diagnosticId(2345, "src/a.ts", 10, 6, "msg")).not.toBe(base);
    expect(diagnosticId(2345, "src/a.ts", 10, 5, "other")).not.toBe(base);
  });
});

describe("isSupportedTypeScriptVersion", () => {
  it("accepts the declared range", () => {
    for (const version of ["5.4.5", "5.5.4", "5.6.3", "5.7.3", "5.8.3", "5.9.3", "5.9.0-beta"]) {
      expect(isSupportedTypeScriptVersion(version)).toBe(true);
    }
  });

  it("refuses below the floor and at or above 6", () => {
    for (const version of ["5.3.3", "5.0.4", "4.9.5", "6.0.0-beta", "7.0.2", "8.0.0"]) {
      expect(isSupportedTypeScriptVersion(version)).toBe(false);
    }
  });

  it("refuses anything unparseable rather than guessing", () => {
    for (const version of ["", "5", "five.four", "v5.4.5"]) {
      expect(isSupportedTypeScriptVersion(version)).toBe(false);
    }
  });
});
