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
import { matchingPathPattern, packageOf } from "../src/pipeline/enrich/2307.js";
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
  "missing-many-properties",
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
  const built: Built = { before, after: enrich(before, facts), facts };
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

/**
 * TS2307 — the one enricher that reads no `context`, only `ProgramFacts`.
 *
 * The three fixtures below are three different truths behind one identical
 * sentence, which is the whole reason the code needed a channel of its own.
 */
describe("2307 · what the declarative files say", () => {
  function factsOn(name: (typeof FIXTURES)[number], specifier: string): string[] {
    return build(name)
      .after.diagnostics.filter((d) => d.code === 2307 && d.message.includes(`'${specifier}'`))
      .flatMap((d) => d.facts.map((f) => f.text));
  }

  it("names the tsconfig line — the one cause that lives in no program file", () => {
    // `wrong-tsconfig-paths` is the only fixture whose root cause is a line of
    // configuration. No `declaredAt` can ever point there, so this fact is the
    // only handle the output has on it.
    const texts = factsOn("wrong-tsconfig-paths", "@domain/order");
    expect(texts).toHaveLength(3);
    for (const text of texts) {
      expect(text).toBe(
        "'@domain/order' matches the tsconfig 'paths' pattern '@domain/*', mapped to 'src/lib/*', baseUrl '.'",
      );
    }
  });

  it("an aliased specifier is not also reported as a missing package", () => {
    // An alias is never in a manifest, so "not in package.json" would be true of
    // every aliased import and news about none of them.
    for (const text of factsOn("wrong-tsconfig-paths", "@domain/customer")) {
      expect(text).not.toContain("package.json");
    }
  });

  it("says a package is undeclared, and names the installer that makes it matter", () => {
    const texts = factsOn("phantom-dependency-pnpm", "qs");
    expect(texts).toHaveLength(6);
    expect(texts).toContain(
      "'qs' is not declared in the dependencies, devDependencies, peerDependencies or optionalDependencies of package.json",
    );
    expect(texts).toContain("installer: pnpm (pnpm-lock.yaml)");
  });

  it("claims nothing about what is installed on disk", () => {
    // `qs` really is present under node_modules/.pnpm/. Saying so needs either a
    // walk of pnpm's private layout or a YAML parser — the reason is argued in
    // `enrich/2307.ts`, and this pins that it stayed unsaid.
    for (const text of factsOn("phantom-dependency-pnpm", "qs")) {
      expect(text).not.toMatch(/node_modules\/\.pnpm|installed|transitive|hoist/);
    }
  });

  it("says the package IS declared when it is — the fact that refutes the default reading", () => {
    // `yarn-pnp-project` is the only fixture whose `before/` has no bug: correct
    // source, package declared and locked, read by a plain Node process that
    // never loads `.pnp.cjs`. Without these two lines the output is three
    // unresolved imports and no way to tell.
    const texts = factsOn("yarn-pnp-project", "@acme/http");
    expect(texts).toContain("'@acme/http' is declared in dependencies of package.json as '1.2.0'");
    expect(texts).toContain(
      "installer: yarn (yarn.lock); '.pnp.cjs' at the project root, and no node_modules directory",
    );
  });

  it("says nothing about a manifest it could not read (rule 5)", () => {
    // `two-independent-roots` has no package.json. "Not declared" would be a
    // claim about a file we never opened, so only the observation that nothing
    // is installed survives.
    for (const text of factsOn("two-independent-roots", "@acme/csv-writer")) {
      expect(text).not.toContain("package.json");
    }
  });

  it("picks the paths pattern TypeScript would pick, not the first that matches", () => {
    // TypeScript's own rule: an exact pattern beats a wildcard, and among
    // wildcards the longest prefix before the `*` wins. Reporting the wrong one
    // of two overlapping patterns would name the wrong tsconfig line — a fact
    // that is precise, checkable, and about the wrong thing.
    const paths = {
      "*": ["src/*"],
      "@domain/*": ["src/lib/*"],
      "@domain/order/*": ["src/order/*"],
      "@domain/exact": ["src/exact.ts"],
    };
    expect(matchingPathPattern("@domain/order/line", paths)).toBe("@domain/order/*");
    expect(matchingPathPattern("@domain/customer", paths)).toBe("@domain/*");
    expect(matchingPathPattern("@domain/exact", paths)).toBe("@domain/exact");
    expect(matchingPathPattern("zod", paths)).toBe("*");
    expect(matchingPathPattern("anything", {})).toBeUndefined();
  });

  it("asks package.json about the package, not about the subpath", () => {
    expect(packageOf("qs/lib/parse")).toBe("qs");
    expect(packageOf("@acme/http/client")).toBe("@acme/http");
    expect(packageOf("@acme/http")).toBe("@acme/http");
    expect(packageOf("zod")).toBe("zod");
  });

  it("relative specifiers get no facts: the imports table cannot confirm them", () => {
    // Same guard as the grouping half, and deliberately the same function —
    // `./x` from two directories is two modules, so nothing here may key on it.
    for (const name of FIXTURES) {
      for (const diagnostic of build(name).after.diagnostics) {
        if (diagnostic.code !== 2307) continue;
        const specifier = /module '([^']+)'/.exec(diagnostic.message)?.[1] ?? "";
        if (specifier.startsWith(".")) expect(diagnostic.facts).toEqual([]);
      }
    }
  });
});

/**
 * TS2739/2741 — the pair that folds, and the §5.2 claim the measurement broke.
 */
describe("2739/2741 · the target type, and the list that needed no completing", () => {
  it("names the declaration TypeScript never prints, on both codes", () => {
    for (const [name, code, expected] of [
      ["missing-multiple-properties", 2739, "required by: interface 'Rect'"],
      ["missing-required-property", 2741, "required by: interface 'Profile'"],
    ] as const) {
      const diagnostics = build(name).after.diagnostics.filter((d) => d.code === code);
      expect(diagnostics).toHaveLength(3);
      for (const diagnostic of diagnostics) {
        expect(diagnostic.facts.map((f) => f.text)).toEqual([expected]);
      }
    }
  });

  it("resolves the return-statement shape too, not just variable declarations", () => {
    // 2 of the 6 diagnostics sit on a `return { … }`, where `getTypeAtLocation`
    // yields `any`. Without the enclosing-signature branch they would resolve to
    // nothing and the cascade would fold 2 of 3 — worse than not folding, since
    // the stray member would read as a second cause.
    const returns = build("missing-multiple-properties").after.diagnostics.filter(
      (d) => d.primary.line === 9,
    );
    expect(returns).toHaveLength(1);
    expect(returns[0]?.facts[0]?.span?.file).toBe("src/geometry/shape.ts");
  });

  it("each fixture folds onto one declaration — the point of capturing them", () => {
    for (const name of ["missing-multiple-properties", "missing-required-property"] as const) {
      const { after } = build(name);
      expect(after.groups).toHaveLength(1);
      expect(after.groups[0]?.members).toHaveLength(3);
    }
  });

  it("no fact repeats the list of missing properties (TS2739 never truncates)", () => {
    // Probed on 5.9.3: 1 missing ⇒ 2741, 2–5 ⇒ 2739 with the list complete,
    // 6+ ⇒ TS2740 truncated at four. The truncation §5.2 attributes to these two
    // belongs to 2740, which is not in the table of ten. Restating a complete
    // list would be a fact that says what the message just said.
    for (const name of ["missing-multiple-properties", "missing-required-property"] as const) {
      for (const diagnostic of build(name).after.diagnostics) {
        for (const fact of diagnostic.facts) {
          expect(fact.text).not.toMatch(/width|height|locale/);
        }
      }
    }
  });

  it("2740 IS captured and enriched — added to §5.2 by decision, 2026-08-02", () => {
    // It was outside the table of ten, and this test asserted its absence. The
    // measurement above is what changed that: 2740 is the only code where "the
    // exact list of the missing" is information the reader does not already
    // have, so it was put in the table deliberately rather than inferred into it.
    expect(CONTEXT_CAPTURE_CODES).toContain(2740);
    expect(ENRICHED_CODES).toContain(2740);
  });
});

describe("2740 · the only code that elides, and the only one told to complete", () => {
  const of2740 = () => build("missing-many-properties").after.diagnostics;

  it("names the members the message counted and declined to print", () => {
    for (const diagnostic of of2740()) {
      expect(diagnostic.code).toBe(2740);
      expect(diagnostic.message).toContain("and 2 more.");
      expect(diagnostic.facts.map((f) => f.text)).toEqual([
        "required by: interface 'ShipmentLabel'",
        "2 more not listed above: insuredCents, signatureRequired",
      ]);
    }
  });

  it("never repeats a member the message already named", () => {
    // The subtraction is against the verbatim message, not `missing.slice(4)`:
    // the tail is only right if TypeScript prints in `getPropertiesOfType`
    // order, which is an assumption about its internals rather than a check.
    for (const diagnostic of of2740()) {
      const completion = diagnostic.facts.find((f) => f.kind === "members")?.text ?? "";
      for (const named of ["weightGrams", "originPostcode", "destinationPostcode", "service"]) {
        expect(diagnostic.message).toContain(named);
        expect(completion).not.toContain(named);
      }
    }
  });

  it("captures `missing` on all three codes but completes only where it elides", () => {
    // Uniform capture, selective use. 2739/2741 print their list in full, so the
    // subtraction comes back empty there — the check doing its job, not a
    // special case written for them.
    for (const name of ["missing-multiple-properties", "missing-required-property"] as const) {
      for (const diagnostic of build(name).after.diagnostics) {
        expect(diagnostic.context?.missing?.length).toBeGreaterThan(0);
        expect(diagnostic.facts.filter((f) => f.kind === "members")).toEqual([]);
      }
    }
  });

  it("the completion survives grouping — it is not a --all-only fact", () => {
    // The regression this guards: under the all-or-nothing suppression that
    // shipped on 2026-08-01, a member's facts were dropped wholesale as soon as
    // one of them pointed at the cause. That hid this line in the default
    // rendering and left it visible only under `--all` — the enrichment missing
    // from exactly the view it was written for.
    const { after, facts } = build("missing-many-properties");
    const text = renderAgentText({
      report: after,
      facts,
      rootLabel: relative(process.cwd(), facts.root) || ".",
      all: false,
    });
    expect(text).toContain("2 more not listed above: insuredCents, signatureRequired");
    // Once for the group, not once per member.
    expect(text.split("2 more not listed above").length - 1).toBe(1);
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

  it("a module group states its facts once for three importers", () => {
    // The economics that made 2307 worth shipping: a group's facts are about the
    // specifier, so three files importing `qs` produce one statement, not three.
    const { after, facts } = build("phantom-dependency-pnpm");
    const text = renderAgentText({
      report: after,
      facts,
      rootLabel: relative(process.cwd(), facts.root) || ".",
      all: false,
    });
    expect(text.split("installer: pnpm").length - 1).toBe(1);
    expect(text.split("error TS2307").length - 1).toBe(3);
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
