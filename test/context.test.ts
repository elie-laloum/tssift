/**
 * Selective context capture (P1 T1).
 *
 * What these tests defend is not "a field is populated" but the property the
 * whole of P1 rests on: **two diagnostics with one cause come back carrying one
 * identical `declaredAt`**. Causality is only allowed to derive on a structural
 * link present in the captured data (§5.1), so if this identity silently stops
 * holding — a path normalised differently here than there, a span that moved
 * from the declaration to its name — P1 folds nothing and no test would notice.
 */
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONTEXT_CAPTURE_CODES } from "../src/codes.js";
import { TsApiSource } from "../src/sources/ts-api.js";
import type { NormalizedDiagnostic, SourceSpan, SymbolRef } from "../src/types.js";

const load = (name: string) =>
  new TsApiSource().load({
    project: fileURLToPath(new URL(`../fixtures/${name}/before`, import.meta.url)),
    captureFor: CONTEXT_CAPTURE_CODES,
  });

/** The single ref a diagnostic offers causality, whichever channel carries it. */
function anchorOf(diagnostic: NormalizedDiagnostic | undefined): SymbolRef | undefined {
  return diagnostic?.context?.subject ?? diagnostic?.context?.expected;
}

/** Fails the test rather than returning `undefined`, so no `!` is needed below. */
function requireAnchor(diagnostic: NormalizedDiagnostic | undefined): SymbolRef {
  const anchor = anchorOf(diagnostic);
  expect(anchor, `no anchor on TS${diagnostic?.code}`).toBeDefined();
  return anchor as SymbolRef;
}

function siteOf(span: SourceSpan): string {
  return `${span.file}:${span.line}:${span.column}`;
}

describe("context capture · partial-interface-rename", () => {
  const { diagnostics } = load("partial-interface-rename");

  it("resolves an anchor on all three codes of the contract fixture", () => {
    expect(diagnostics.map((d) => d.code)).toEqual([2353, 2339, 2345]);
    for (const diagnostic of diagnostics) {
      expect(anchorOf(diagnostic), `TS${diagnostic.code} has no anchor`).toBeDefined();
    }
  });

  it("collapses all three onto one identical declaration site", () => {
    // The property P1 exists to exploit: three different codes, three different
    // syntaxes, one cause. If this ever returns three sites, the fixture stops
    // demonstrating anything and PROJECT.md §6's P1 example becomes fiction.
    const sites = new Set(diagnostics.map((d) => siteOf(requireAnchor(d).declaredAt)));
    expect([...sites]).toEqual(["src/types/user.ts:7:1"]);
  });

  it("names the interface and lists its real members", () => {
    const anchor = requireAnchor(diagnostics[1]);
    expect(anchor.name).toBe("CreateUserInput");
    expect(anchor.kind).toBe("interface");
    expect(anchor.memberNames).toContain("email");
    expect(anchor.memberNames).not.toContain("emailAddress");
  });

  it("keeps declaredAt relative, POSIX and 1-indexed like any other span", () => {
    for (const diagnostic of diagnostics) {
      const span = requireAnchor(diagnostic).declaredAt;
      expect(span.file.startsWith("/")).toBe(false);
      expect(span.file).not.toMatch(/\\/);
      expect(span.line).toBeGreaterThanOrEqual(1);
      expect(span.column).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("context capture · two-independent-roots (the negative control)", () => {
  const { diagnostics } = load("two-independent-roots");

  it("gives the two roots two different anchors, or none at all", () => {
    // The Definition of Done criterion, checked one layer below causality: if
    // capture already handed these two the same `declaredAt`, no downstream
    // rule could tell them apart (PROJECT.md §12).
    const sites = diagnostics.map((d) => {
      const anchor = anchorOf(d);
      return anchor ? siteOf(anchor.declaredAt) : `none:${d.id}`;
    });
    expect(new Set(sites).size).toBe(diagnostics.length);
  });

  it("resolves the 2339 to the type declared in its own file, not the other one", () => {
    const anchor = requireAnchor(diagnostics.find((d) => d.code === 2339));
    expect(anchor.name).toBe("LineItem");
    expect(anchor.declaredAt.file).toBe("src/billing/invoice.ts");
  });

  it("leaves the unresolved-module diagnostic without a context", () => {
    // TS2307 is deliberately absent from CONTEXT_CAPTURE_CODES: the module did
    // not resolve, so there is no declaration to point at. Its derivation runs
    // on `ProgramFacts.imports` instead (src/codes.ts).
    const module = diagnostics.find((d) => d.code === 2307);
    expect(module).toBeDefined();
    expect(module?.context).toBeUndefined();
  });
});

describe("context capture · discipline", () => {
  it("captures nothing when the code list is empty", () => {
    const { diagnostics } = new TsApiSource().load({
      project: fileURLToPath(
        new URL("../fixtures/partial-interface-rename/before", import.meta.url),
      ),
      captureFor: [],
    });
    for (const diagnostic of diagnostics) expect(diagnostic.context).toBeUndefined();
  });

  it("captures nothing for a code outside the list", () => {
    // overload-mismatch is TS2769, a §5.2 enrichment code held for P2.
    const { diagnostics } = load("overload-mismatch");
    expect(diagnostics.map((d) => d.code)).toEqual([2769]);
    expect(diagnostics[0]?.context).toBeUndefined();
  });

  it("is deterministic across runs, anchors included", () => {
    const key = (result: ReturnType<typeof load>) =>
      result.diagnostics.map((d) => {
        const anchor = anchorOf(d);
        return `${d.id}|${anchor ? `${siteOf(anchor.declaredAt)}|${anchor.name}` : "-"}`;
      });
    expect(key(load("partial-interface-rename"))).toEqual(key(load("partial-interface-rename")));
  });

  it("never leaks a compiler SyntaxKind name into `kind`", () => {
    // `kind` is part of the published model; `ts.SyntaxKind[…]` spellings are
    // free to move between TypeScript minors and would break consumers.
    const kinds = new Set<string>();
    for (const name of ["partial-interface-rename", "two-independent-roots"]) {
      for (const diagnostic of load(name).diagnostics) {
        const anchor = anchorOf(diagnostic);
        if (anchor) kinds.add(anchor.kind);
      }
    }
    for (const kind of kinds) expect(kind).toMatch(/^[a-z][a-z-]*$/);
  });
});

describe("context capture · the report stays a projection (rule 14)", () => {
  it("keeps context out of agent-text and in json", async () => {
    const { renderAgentText } = await import("../src/render/agent-text.js");
    const { renderJson } = await import("../src/render/json.js");
    const result = load("partial-interface-rename");
    const input = { ...result, rootLabel: relative(process.cwd(), result.facts.root), all: false };

    const text = renderAgentText(input);
    const json = renderJson(input);

    // P1 T1 only *captures*. Rendering the anchor is T4's job, together with the
    // grouping that makes it meaningful; until then json carries it and text
    // does not, which is the allowed direction of the asymmetry.
    expect(json).toContain('"declaredAt"');
    expect(text).not.toContain("declaredAt");
  });
});
