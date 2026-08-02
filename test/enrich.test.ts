/**
 * P2 — the enrichment stage.
 *
 * The first test in this file is the one AGENTS.md makes **mandatory the moment
 * an enricher exists**: every `Fact.text` produced over every fixture is scanned
 * for an imperative. It runs on the facts themselves rather than on the rendered
 * text, because the renderer suppresses a group member's facts as duplicates of
 * the header — so a prescription could reach json while the text scan in
 * `render.test.ts` stayed green.
 */
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONTEXT_CAPTURE_CODES } from "../src/codes.js";
import { dedupe, detectCausality, ENRICHED_CODES, enrich } from "../src/pipeline/index.js";
import { renderAgentText } from "../src/render/agent-text.js";
import { TsApiSource } from "../src/sources/ts-api.js";
import type { DiagnosticReport, ProgramFacts } from "../src/types.js";

const FIXTURES = [
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
  "wrong-tsconfig-paths",
  "monorepo-cross-package",
  "phantom-dependency-pnpm",
  "yarn-pnp-project",
  "missing-type-import",
  "cannot-find-name",
  "missing-multiple-properties",
  "two-roots-one-file",
] as const;

interface Built {
  before: DiagnosticReport;
  after: DiagnosticReport;
  facts: ProgramFacts;
}

const cache = new Map<string, Built>();

function build(name: (typeof FIXTURES)[number]): Built {
  const hit = cache.get(name);
  if (hit) return hit;

  const project = fileURLToPath(new URL(`../fixtures/${name}/before`, import.meta.url));
  const { diagnostics, facts } = new TsApiSource().load({
    project,
    captureFor: CONTEXT_CAPTURE_CODES,
  });
  const before = detectCausality(dedupe(diagnostics, facts), facts);
  const built: Built = { before, after: enrich(before), facts };
  cache.set(name, built);
  return built;
}

describe("rule 1 · not one imperative in any Fact.text", () => {
  for (const name of FIXTURES) {
    it(`${name} · every fact is a statement`, () => {
      // Same vocabulary as the frame scan in render.test.ts, and the same
      // reason for the word boundaries: `fix` matches "fixtures", `use `
      // matches "cause ". A test that cries wolf gets deleted.
      const imperative =
        /\b(add|change|should|shall|try|use|fix|correct|replace|must|need|remove|rename|make|set|check|ensure|consider)\b/i;

      for (const diagnostic of build(name).after.diagnostics) {
        for (const fact of diagnostic.facts) {
          expect(fact.text, `TS${diagnostic.code} ${fact.kind}`).not.toMatch(imperative);
        }
      }
    });
  }

  it("the scan is not vacuous — some fixture actually produces facts", () => {
    const total = FIXTURES.map((name) =>
      build(name).after.diagnostics.reduce((sum, d) => sum + d.facts.length, 0),
    ).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(0);
  });
});

describe("rule 2 · enrichment removes nothing", () => {
  for (const name of FIXTURES) {
    it(`${name} · same diagnostics, same ids, same groups`, () => {
      const { before, after } = build(name);
      expect(after.diagnostics.map((d) => d.id)).toEqual(before.diagnostics.map((d) => d.id));
      expect(after.groups).toEqual(before.groups);
    });
  }
});

describe("the table decides who gets facts", () => {
  it("only codes with a registered enricher carry any", () => {
    for (const name of FIXTURES) {
      for (const diagnostic of build(name).after.diagnostics) {
        if (diagnostic.facts.length > 0) expect(ENRICHED_CODES).toContain(diagnostic.code);
      }
    }
  });

  it("a table code that resolved no context degrades to low confidence (rule 5)", () => {
    // The honest signal: we meant to add a declaration site and the capture came
    // back empty. A code *outside* the table renders natively by design and stays
    // high — nothing was claimed, so nothing is uncertain.
    for (const name of FIXTURES) {
      for (const diagnostic of build(name).after.diagnostics) {
        const inTable = ENRICHED_CODES.includes(diagnostic.code);
        const expected = !inTable || diagnostic.facts.length > 0 ? "high" : "low";
        expect(diagnostic.confidence, `${name} TS${diagnostic.code}`).toBe(expected);
      }
    }
  });

  it("2769 gets no enricher: its payload is already the message chain", () => {
    // Not an oversight — see the reasoning in pipeline/enrich/index.ts. Pinned
    // so that re-adding it is a deliberate act with a measurement behind it.
    expect(ENRICHED_CODES).not.toContain(2769);
    const overload = build("overload-mismatch").after.diagnostics.find((d) => d.code === 2769);
    expect(overload?.facts).toEqual([]);
    expect(overload?.chain.length).toBeGreaterThan(0);
  });

  it("2551 gets no enricher: TypeScript's own suggestion is not degraded", () => {
    expect(ENRICHED_CODES).not.toContain(2551);
    for (const diagnostic of build("misspelled-property").after.diagnostics) {
      if (diagnostic.code === 2551) expect(diagnostic.facts).toEqual([]);
    }
  });
});

describe("what a fact says", () => {
  it("names the declaration site TypeScript never prints", () => {
    const [diagnostic] = build("partial-interface-rename").after.diagnostics.filter(
      (d) => d.code === 2339,
    );
    const declaration = diagnostic?.facts.find((f) => f.kind === "declaration");
    expect(declaration?.span?.file).toBe("src/types/user.ts");
    expect(declaration?.text).toContain("interface 'CreateUserInput'");
  });

  it("a named interface's shape is not repeated as its own name", () => {
    // `checker.typeToString` renders a named type as its name, so a shape line
    // would read `type 'CreateUserInput' CreateUserInput`. PROJECT.md §6's
    // mock-up assumed an expanded shape; it does not exist for named types.
    const [diagnostic] = build("partial-interface-rename").after.diagnostics.filter(
      (d) => d.code === 2339,
    );
    const declaration = diagnostic?.facts.find((f) => f.kind === "declaration");
    expect(declaration?.text).toBe("type: interface 'CreateUserInput'");
  });

  it("a resolved signature is rendered, because that one is never the name", () => {
    const [diagnostic] = build("arity-changed").after.diagnostics.filter((d) => d.code === 2554);
    const declaration = diagnostic?.facts.find((f) => f.kind === "declaration");
    expect(declaration?.text).toContain("(action: string, actor: string): AuditEvent");
  });

  it("a signature carries no member list: a function type's members are plumbing", () => {
    for (const diagnostic of build("arity-changed").after.diagnostics) {
      if (diagnostic.code === 2554) {
        expect(diagnostic.facts.map((f) => f.kind)).toEqual(["declaration"]);
      }
    }
  });

  it("a module has exports, a type has properties — never 'members'", () => {
    // 'member' is ambiguous exactly where the list is most useful: for a union
    // it means a constituent. `narrowed-union-member` is the witness.
    const union = build("narrowed-union-member").after.diagnostics.find((d) => d.code === 2339);
    expect(union?.facts.find((f) => f.kind === "members")?.text).toContain("1 property:");

    const barrel = build("broken-barrel-export").after.diagnostics.find((d) => d.code === 2724);
    expect(barrel?.facts.find((f) => f.kind === "members")?.text).toContain("3 exports:");
  });

  it("no fact suggests a near match, on any fixture", () => {
    // Measured 2026-08-01: TypeScript emits TS2551/TS2724 instead whenever its
    // own speller finds a candidate, so a suggestion here fires only where it
    // said no. At a comparable threshold it fired 38 times over fixtures and
    // corpus, on two names, and was wrong on both (EVAL.md § P2).
    for (const name of FIXTURES) {
      for (const diagnostic of build(name).after.diagnostics) {
        expect(diagnostic.facts.every((f) => f.kind !== "near-match")).toBe(true);
      }
    }
  });
});

describe("the renderer says a group's facts once, not once per member", () => {
  it("the property list appears exactly once under a folded cause", () => {
    const { after, facts } = build("partial-interface-rename");
    const text = renderAgentText({
      report: after,
      facts,
      rootLabel: relative(process.cwd(), facts.root) || ".",
      all: false,
    });
    const occurrences = text.split("3 properties: id, email, name").length - 1;
    expect(occurrences).toBe(1);
    // …and all three members really do carry it in the model (rule 14).
    const carriers = after.diagnostics.filter((d) =>
      d.facts.some((f) => f.text.includes("3 properties: id, email, name")),
    );
    expect(carriers).toHaveLength(3);
  });

  it("--all restores the facts on every diagnostic", () => {
    const { after, facts } = build("partial-interface-rename");
    const text = renderAgentText({
      report: after,
      facts,
      rootLabel: relative(process.cwd(), facts.root) || ".",
      all: true,
    });
    expect(text.split("3 properties: id, email, name").length - 1).toBe(3);
  });
});
