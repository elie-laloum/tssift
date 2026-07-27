import { describe, expect, it } from "vitest";
import { parseArgs, run, type Streams } from "../src/run.js";

function capture(argv: string[]): { code: number; out: string; err: string } {
  let out = "";
  let err = "";
  const streams: Streams = {
    out: (text) => {
      out += text;
    },
    err: (text) => {
      err += text;
    },
  };
  return { code: run(argv, streams), out, err };
}

describe("cli · exit codes", () => {
  it("exits 1 on a project with type errors, report on stdout", () => {
    const { code, out, err } = capture(["--project", "fixtures/partial-interface-rename/before"]);
    expect(code).toBe(1);
    expect(out).toMatch(/^root: /);
    expect(out).toContain("TS2345");
    expect(err).toBe("");
  });

  it("exits 0 on a clean project and still prints a line", () => {
    const { code, out, err } = capture(["--project", "tsconfig.json"]);
    expect(code).toBe(0);
    expect(out.trim().length).toBeGreaterThan(0);
    expect(out).toContain("0 errors");
    expect(err).toBe("");
  });

  it("exits 2 on a missing tsconfig, with nothing on stdout", () => {
    const { code, out, err } = capture(["--project", "./does-not-exist.json"]);
    expect(code).toBe(2);
    expect(out).toBe("");
    expect(err).toContain("tsconfig not found");
    expect(err).toContain("does not search parent directories");
  });

  it("exits 2 on an unknown flag rather than ignoring it", () => {
    const { code, out, err } = capture(["--nope"]);
    expect(code).toBe(2);
    expect(out).toBe("");
    expect(err).toContain('Unknown argument "--nope"');
  });

  it("exits 2 on an unknown --format", () => {
    const { code, err } = capture(["--format", "yaml"]);
    expect(code).toBe(2);
    expect(err).toContain("Unknown --format");
    expect(err).toContain("agent-text, json");
  });
});

describe("cli · flags", () => {
  it("defaults to ./tsconfig.json and agent-text, without upward search", () => {
    expect(parseArgs([])).toEqual({
      project: "./tsconfig.json",
      format: "agent-text",
      all: false,
      help: false,
    });
  });

  it("ships --budget-tokens together with the truncation that honours it", () => {
    // In P0 this test asserted the opposite — that the flag did NOT parse —
    // because a flag that parses and does nothing is a lie with a version
    // number (decision 27). It flipped in P1, when `pipeline/budget.ts` landed
    // in the same change. Kept rather than deleted: it is still the assertion
    // that the two never drift apart.
    expect(parseArgs(["--budget-tokens", "4000"]).budgetTokens).toBe(4000);
  });

  it("emits json when asked", () => {
    const { code, out } = capture([
      "--project",
      "fixtures/two-independent-roots/before",
      "--format",
      "json",
    ]);
    expect(code).toBe(1);
    const report = JSON.parse(out) as { counts: { errors: number }; diagnostics: unknown[] };
    expect(report.counts.errors).toBe(2);
    expect(report.diagnostics).toHaveLength(2);
  });

  it("--all restores every diagnostic (nothing is declassed in P0)", () => {
    const plain = capture(["--project", "fixtures/partial-interface-rename/before"]);
    const all = capture(["--project", "fixtures/partial-interface-rename/before", "--all"]);
    const lines = (value: string) => (value.match(/^\[\d+\] /gm) ?? []).length;
    expect(lines(all.out)).toBe(3);
    expect(lines(all.out)).toBeGreaterThanOrEqual(lines(plain.out));
    expect(all.code).toBe(1);
  });

  it("prints usage on --help and exits 0", () => {
    const { code, out, err } = capture(["--help"]);
    expect(code).toBe(0);
    expect(out).toContain("Usage:");
    expect(out).toContain("--project");
    expect(err).toBe("");
  });
});
