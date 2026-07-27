/**
 * `pipeline/dedupe.ts` — the one stage allowed to remove rather than declass.
 *
 * The measured duplicate rate is zero (283 diagnostics, 2026-07-27), so the
 * tests that matter are not "it removes duplicates" but the two boundaries that
 * would turn this stage into a rule 2 violation the day a real program produces
 * one: it must never remove on `id` alone, and it must never remove anything
 * else at all.
 */
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONTEXT_CAPTURE_CODES } from "../src/codes.js";
import { dedupe } from "../src/pipeline/dedupe.js";
import { TsApiSource } from "../src/sources/ts-api.js";
import type { NormalizedDiagnostic, ProgramFacts } from "../src/types.js";

const FIXTURES = [
  "partial-interface-rename",
  "two-independent-roots",
  "overload-mismatch",
  "broken-barrel-export",
];

const load = (name: string) =>
  new TsApiSource().load({
    project: fileURLToPath(new URL(`../fixtures/${name}/before`, import.meta.url)),
    captureFor: CONTEXT_CAPTURE_CODES,
  });

const FACTS: ProgramFacts = {
  root: "/nowhere",
  files: [],
  imports: {},
  typescript: { version: "5.9.3", path: "/nowhere" },
};

function diagnostic(overrides: Partial<NormalizedDiagnostic> = {}): NormalizedDiagnostic {
  return {
    id: "aaaaaaaaaaaa",
    code: 2339,
    category: "error",
    primary: { file: "src/a.ts", line: 1, column: 1 },
    message: "Property 'x' does not exist on type 'T'.",
    chain: [],
    related: [],
    ...overrides,
  };
}

describe("dedupe · on real programs", () => {
  for (const name of FIXTURES) {
    it(`${name} · removes nothing, because there is nothing to remove`, () => {
      const { diagnostics, facts } = load(name);
      expect(dedupe(diagnostics, facts)).toEqual(diagnostics);
    });
  }

  it("preserves order and identity exactly", () => {
    const { diagnostics, facts } = load("partial-interface-rename");
    const out = dedupe(diagnostics, facts);
    expect(out.map((d) => d.id)).toEqual(diagnostics.map((d) => d.id));
    // Same objects, not copies: the stage is a filter, not a transform.
    for (const [index, item] of out.entries()) expect(item).toBe(diagnostics[index]);
  });

  it("is idempotent", () => {
    const { diagnostics, facts } = load("overload-mismatch");
    expect(dedupe(dedupe(diagnostics, facts), facts)).toEqual(dedupe(diagnostics, facts));
  });
});

describe("dedupe · the boundary that protects rule 2", () => {
  it("removes a byte-identical copy", () => {
    const one = diagnostic();
    const out = dedupe([one, { ...one }], FACTS);
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(one);
  });

  it("KEEPS two diagnostics that share an id but not their payload", () => {
    // The whole point. `id` is sha256(code|file|line|col|message) — it covers
    // neither `related`, nor `chain`, nor `context`. Removing on `id` alone
    // would silently drop the resolved `declaredAt` that all of P1 runs on,
    // and no downstream stage could ever notice.
    const bare = diagnostic();
    const withContext = diagnostic({
      context: {
        subject: {
          name: "T",
          kind: "interface",
          declaredAt: { file: "src/t.ts", line: 3, column: 1 },
        },
      },
    });

    expect(bare.id).toBe(withContext.id);
    expect(dedupe([bare, withContext], FACTS)).toHaveLength(2);
  });

  it("KEEPS two diagnostics that share an id but not their related information", () => {
    const bare = diagnostic();
    const withRelated = diagnostic({ related: [{ message: "'x' is declared here." }] });

    expect(bare.id).toBe(withRelated.id);
    expect(dedupe([bare, withRelated], FACTS)).toHaveLength(2);
  });

  it("keeps distinct diagnostics that merely resemble one another", () => {
    // Same code, same file, adjacent lines, near-identical message. A
    // near-identity heuristic would fold these; §5.1 forbids exactly that.
    const first = diagnostic({
      id: "aaaaaaaaaaaa",
      primary: { file: "src/a.ts", line: 1, column: 1 },
    });
    const second = diagnostic({
      id: "bbbbbbbbbbbb",
      primary: { file: "src/a.ts", line: 2, column: 1 },
    });
    expect(dedupe([first, second], FACTS)).toHaveLength(2);
  });

  it("is pure — it does not mutate its input", () => {
    const input = [diagnostic(), diagnostic({ id: "bbbbbbbbbbbb" })];
    const snapshot = JSON.stringify(input);
    dedupe(input, FACTS);
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(input).toHaveLength(2);
  });
});
