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
    const { dedupe, detectCausality } = await import("../src/pipeline/index.js");
    const { diagnostics, facts } = load("partial-interface-rename");
    const input = {
      report: detectCausality(dedupe(diagnostics, facts), facts),
      facts,
      rootLabel: relative(process.cwd(), facts.root),
      all: false,
    };

    const text = renderAgentText(input);
    const json = renderJson(input);

    // P1 T1 only *captures*. Rendering the anchor is T4's job, together with the
    // grouping that makes it meaningful; until then json carries it and text
    // does not, which is the allowed direction of the asymmetry.
    expect(json).toContain('"declaredAt"');
    expect(text).not.toContain("declaredAt");
  });
});

describe("context capture · the 18047 family (2026-08-04)", () => {
  const diagnostics = load("nullable-chain").diagnostics;

  it("resolves all four onto the one declaration that is nullable", () => {
    // The claim that reopened this code: the causality link needs no
    // control-flow analysis. `proxy` at settings.ts:13:3 is the line
    // `meta.json` names as the root cause, and it is where every read lands.
    expect(diagnostics).toHaveLength(4);
    const sites = diagnostics.map((d) => siteOf(requireAnchor(d).declaredAt));
    expect(new Set(sites).size).toBe(1);
    expect(sites[0]).toBe("src/config/settings.ts:13:3");
  });

  it("names the property, not the member read through it", () => {
    // The false positive this rule exists to avoid. Widening the node past the
    // quoted expression reaches `settings.proxy.host` and resolves `host` — a
    // property that is not nullable and is not the cause. Keying there would
    // split one cascade into two groups (host, port) and head each with a
    // healthy declaration: PROJECT.md §11's critical failure.
    for (const diagnostic of diagnostics) {
      const anchor = requireAnchor(diagnostic);
      expect(anchor.name).toBe("proxy");
      expect(anchor.name).not.toBe("host");
      expect(anchor.name).not.toBe("port");
    }
  });

  it("carries the declared type, which is the fact that explains every site", () => {
    expect(requireAnchor(diagnostics[0]).signature).toBe("ProxyConfig | null");
  });
});

describe("context capture · what the 18047 anchor cannot reach", () => {
  const diagnostics = load("private-fields-and-anonymous-nullish").diagnostics;

  it("leaves TS2531 without context, because it has no quoted expression", () => {
    // `Object is possibly 'null'` is the anonymous half of the family: no {0},
    // so no anchor, so nothing for the resolver to check itself against. This
    // is structural, not a gap — 2531/2532/2533 can never be added to
    // CONTEXT_CAPTURE_CODES, and this test is what stops that being "fixed".
    const anonymous = diagnostics.filter((d) => d.code === 2531);
    expect(anonymous).toHaveLength(1);
    expect(anonymous[0]?.context).toBeUndefined();
  });

  it("keeps the three anonymous codes out of the capture list", () => {
    for (const code of [2531, 2532, 2533]) {
      expect(CONTEXT_CAPTURE_CODES).not.toContain(code);
    }
  });
});

describe("context capture · ECMAScript private fields are not names a reader can use", () => {
  const diagnostics = load("private-fields-and-anonymous-nullish").diagnostics;

  it("filters #private out of a member list, and keeps the public ones", () => {
    // Found on hono: 9 of the 12 names the display cap allows were #-private,
    // and `#req` sat beside the very `req` that had gone missing. Across the 28
    // pre-existing B0 targets the saving is 0.00 % — no fixture had one at all,
    // which is why this one exists.
    const members = requireAnchor(diagnostics.find((d) => d.code === 2339))?.memberNames ?? [];
    expect(members.filter((name) => name.startsWith("#"))).toEqual([]);
    expect(members).toContain("accessToken");
    expect(members).toContain("userId");
  });
});
