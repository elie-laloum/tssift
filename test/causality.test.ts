/**
 * `pipeline/causality.ts` — the §5.1 threshold, defended.
 *
 * These tests exist because causality is the one component whose failure is
 * *invisible*: a false positive does not crash, it produces a shorter, more
 * confident report that sends the reader to the wrong file. So the tests are
 * weighted towards what must NOT happen.
 */
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONTEXT_CAPTURE_CODES } from "../src/codes.js";
import { detectCausality } from "../src/pipeline/causality.js";
import { MAX_SHOWN_MEMBERS } from "../src/pipeline/group.js";
import { TsApiSource } from "../src/sources/ts-api.js";
import type { NormalizedDiagnostic, ProgramFacts, SymbolRef } from "../src/types.js";

function analyse(name: string) {
  const project = fileURLToPath(new URL(`../fixtures/${name}/before`, import.meta.url));
  const { diagnostics, facts } = new TsApiSource().load({
    project,
    captureFor: CONTEXT_CAPTURE_CODES,
  });
  return { report: detectCausality(diagnostics, facts), raw: diagnostics, facts };
}

/* ------------------------------------------------------------------ */
/* Synthetic fixtures, for the cases no real project produces on demand */
/* ------------------------------------------------------------------ */

const FACTS: ProgramFacts = {
  root: "/nowhere",
  files: ["src/a.ts", "src/b.ts", "src/decl.ts"],
  imports: {},
  typescript: { version: "5.9.3", path: "/nowhere" },
};

function symbol(file: string, line: number, column = 1, name = "T"): SymbolRef {
  return { name, kind: "interface", declaredAt: { file, line, column } };
}

let counter = 0;
function diagnostic(
  overrides: Partial<NormalizedDiagnostic> & { subject?: SymbolRef } = {},
): NormalizedDiagnostic {
  const { subject, ...rest } = overrides;
  counter += 1;
  return {
    id: `id${String(counter).padStart(10, "0")}`,
    code: 2339,
    category: "error",
    primary: { file: "src/a.ts", line: counter, column: 1 },
    message: "Property 'x' does not exist on type 'T'.",
    chain: [],
    related: [],
    ...(subject ? { context: { subject } } : {}),
    ...rest,
  };
}

/* ------------------------------------------------------------------ */

describe("causality · two-independent-roots (Definition of Done, PROJECT.md §12)", () => {
  // "Zéro faux positif de causalité sur la fixture double-racine" is a shipping
  // criterion, not a nice-to-have. The two failures share no import, no type and
  // no identifier; reporting them as one root and one derived would mean the
  // agent never sees the second bug at all.
  const { report } = analyse("two-independent-roots");

  it("reports two roots and zero derived", () => {
    expect(report.diagnostics).toHaveLength(2);
    expect(report.diagnostics.map((d) => d.role)).toEqual(["root", "root"]);
    expect(report.diagnostics.every((d) => d.derivedFrom.length === 0)).toBe(true);
  });

  it("forms no group at all", () => {
    expect(report.groups).toEqual([]);
    expect(report.diagnostics.every((d) => d.group === undefined)).toBe(true);
  });

  it("keeps the two causes distinct", () => {
    const codes = report.diagnostics.map((d) => d.code).sort((a, b) => a - b);
    expect(codes).toEqual([2307, 2339]);
  });
});

describe("causality · partial-interface-rename", () => {
  const { report } = analyse("partial-interface-rename");

  it("folds three codes onto one declaration", () => {
    expect(report.groups).toHaveLength(1);
    expect(report.groups[0]?.members).toHaveLength(3);
  });

  it("heads the group with the declaration, not with a member", () => {
    const cause = report.groups[0]?.cause;
    expect(cause?.kind).toBe("declaration");
    expect(cause?.symbol.name).toBe("CreateUserInput");
    expect(cause?.symbol.declaredAt.file).toBe("src/types/user.ts");
    // No member sits on the cause, so no member may claim to be the root.
    expect(report.diagnostics.every((d) => d.role === "derived")).toBe(true);
    expect(report.diagnostics.every((d) => d.derivedFrom.length === 0)).toBe(true);
  });

  it("gives every member the same group id", () => {
    const ids = new Set(report.diagnostics.map((d) => d.group));
    expect(ids.size).toBe(1);
    expect([...ids][0]).toBe(report.groups[0]?.id);
  });
});

describe("causality · broken-barrel-export", () => {
  // The fixture that closes the trio's known hole: the other three are one- or
  // two-file, and this is the only one where a single cause is consumed by
  // three separate modules. Built that way on purpose — removing an export from
  // a REAL barrel in `lekes` produced no cascade at all, because its eleven
  // importers each wanted a different symbol (eval/corpus.json).
  const { report } = analyse("broken-barrel-export");

  it("sees one root cause and three derived, across three files", () => {
    expect(report.groups).toHaveLength(1);
    expect(report.groups[0]?.members).toHaveLength(3);
    expect(report.diagnostics.filter((d) => d.role === "derived")).toHaveLength(3);

    const files = new Set(report.diagnostics.map((d) => d.primary.file));
    expect(files.size).toBe(3);
  });

  it("names the barrel as the cause, not the module that still exports the symbol", () => {
    // src/domain/order.ts is correct and unchanged. The barrel is what stopped
    // re-exporting, and it is what the reader has to open.
    const cause = report.groups[0]?.cause;
    expect(cause?.symbol.kind).toBe("module");
    expect(cause?.symbol.declaredAt.file).toBe("src/domain/index.ts");
    expect(cause?.symbol.declaredAt.line).toBe(1);
  });

  it("folds TS2724, which is what TypeScript actually emits here", () => {
    // Not TS2305. TypeScript picks the "Did you mean" variant whenever a near
    // match exists among the module's real exports, and `Order` sits beside
    // `OrderId`. Which of the two fires is a property of the names, not of the
    // failure — hence both are captured (src/codes.ts).
    expect(new Set(report.diagnostics.map((d) => d.code))).toEqual(new Set([2724]));
  });
});

describe("causality · arity-changed", () => {
  // The committed twin of .corpus/lekes-ok-arity-changed, which folds 152
  // diagnostics into one entry and is the single best piece of evidence for H1
  // — and which a fresh clone cannot run, `.corpus/` being git-ignored and
  // derived from a private repository.
  const { report } = analyse("arity-changed");

  it("folds four call sites onto the signature they all miss an argument for", () => {
    expect(report.groups).toHaveLength(1);
    expect(report.groups[0]?.members).toHaveLength(4);
    expect(report.groups[0]?.cause.symbol.kind).toBe("function");
    expect(report.groups[0]?.cause.symbol.name).toBe("auditEvent");
    expect(report.groups[0]?.cause.symbol.declaredAt.file).toBe("src/audit/event.ts");
  });

  it("folds two call sites living in the same file", () => {
    // src/accounts/session.ts calls twice. Grouping must key on the shared
    // declaration, not on the calling file — two sites in one file are no more
    // related to each other than to the two in other files.
    const files = report.diagnostics.map((d) => d.primary.file);
    expect(files.filter((file) => file === "src/accounts/session.ts")).toHaveLength(2);
    expect(new Set(report.diagnostics.map((d) => d.group)).size).toBe(1);
  });

  it("is the only fixture that exceeds the display cap", () => {
    // 4 members against MAX_SHOWN_MEMBERS = 3, so it is the only committed
    // project whose default rendering exercises the `+N more sites` counter.
    expect(report.groups[0]?.members.length).toBeGreaterThan(MAX_SHOWN_MEMBERS);
  });
});

describe("causality · narrowed-union-member", () => {
  const { report } = analyse("narrowed-union-member");

  it("folds eight diagnostics onto the union's type alias", () => {
    expect(report.groups).toHaveLength(1);
    expect(report.groups[0]?.members).toHaveLength(8);
    expect(report.groups[0]?.cause.symbol.kind).toBe("type-alias");
    expect(report.groups[0]?.cause.symbol.name).toBe("Shape");
  });

  it("folds the second-order diagnostics too", () => {
    // The failed narrowing on `kind` leaves the value un-narrowed, so `.radius`
    // and `.side` fail as a consequence of a consequence. Both orders resolve
    // to the same declaration, so both land in the one group — no fixture other
    // than this one has a cause two steps removed from its diagnostic.
    const properties = report.diagnostics.map((d) => d.message.match(/Property '(\w+)'/)?.[1]);
    expect(new Set(properties)).toEqual(new Set(["kind", "radius", "side", "base", "height"]));
    expect(report.diagnostics.every((d) => d.group === report.groups[0]?.id)).toBe(true);
  });
});

describe("causality · the cascades the §5.1 threshold declines to fold", () => {
  // Both fixtures below are single-cause cascades that a human would group at a
  // glance, and both are reported as lone roots. That is the threshold working
  // as specified, not a defect — and these tests exist so that the day capture
  // is extended, the change shows up as a failure here rather than as a silent
  // improvement nobody measured. Rule 8 keeps them unfolded until B1.

  it("nullable-chain · four dereferences of one nullable property stay four roots", () => {
    const { report } = analyse("nullable-chain");
    expect(report.diagnostics).toHaveLength(4);
    expect(new Set(report.diagnostics.map((d) => d.code))).toEqual(new Set([18047]));
    expect(report.groups).toEqual([]);
    expect(report.diagnostics.every((d) => d.role === "root")).toBe(true);
    // Nothing was captured, so there is nothing to key on. 18047 is in the §5.2
    // table of ten; this is a known gap, not an oversight.
    expect(report.diagnostics.every((d) => d.context === undefined)).toBe(true);
  });

  it("missing-required-property · three sites stay three roots though each PRINTS the cause", () => {
    // The sharper of the two. Every diagnostic carries a related pointing at
    // the very declaration they share, so the report names the shared cause
    // three times and still declines to group on it. This is design question 2
    // of the P1 plan — does a related span count as a declaredAt? — closed as
    // moot when TS2554 turned out to resolve through getResolvedSignature().
    // Here it is not moot.
    const { report } = analyse("missing-required-property");
    expect(report.groups).toEqual([]);
    expect(report.diagnostics.every((d) => d.role === "root")).toBe(true);

    const spans = report.diagnostics.map((d) => d.related[0]?.span);
    expect(spans).toHaveLength(3);
    for (const span of spans) {
      expect(span?.file).toBe("src/accounts/profile.ts");
      expect(span?.line).toBe(10);
    }
    // One and the same position, three times over, unused.
    expect(new Set(spans.map((span) => `${span?.file}:${span?.line}:${span?.column}`)).size).toBe(
      1,
    );
  });
});

describe("causality · what must never happen", () => {
  it("does not group on a declaration outside the program's own files", () => {
    // Measured, not hypothetical: on .corpus/lekes-result-value-renamed a TS2345
    // resolves its expected type to <ts-lib>/lib.es2015.collection.d.ts —
    // `interface Map`. Two unrelated bugs mis-calling a Map method would merge,
    // which is the failure PROJECT.md §11 classes as critical.
    const foreign = symbol("<ts-lib>/lib.es2015.collection.d.ts", 19, 1, "Map");
    const report = detectCausality(
      [diagnostic({ subject: foreign }), diagnostic({ subject: foreign })],
      FACTS,
    );
    expect(report.groups).toEqual([]);
    expect(report.diagnostics.every((d) => d.role === "root")).toBe(true);
  });

  it("does not group on a declaration inside node_modules", () => {
    const vendored = symbol("node_modules/zod/index.d.ts", 42, 1, "ZodType");
    const report = detectCausality(
      [diagnostic({ subject: vendored }), diagnostic({ subject: vendored })],
      FACTS,
    );
    expect(report.groups).toEqual([]);
  });

  it("does not group on the same name at a different position", () => {
    // Two distinct bindings that shadow one another carry the same name. §5.1
    // excludes "the same identifier" by name for exactly this reason.
    const report = detectCausality(
      [
        diagnostic({ subject: symbol("src/decl.ts", 3, 1, "T") }),
        diagnostic({ subject: symbol("src/decl.ts", 90, 1, "T") }),
      ],
      FACTS,
    );
    expect(report.groups).toEqual([]);
  });

  it("does not group on the same file and the same code", () => {
    // Explicitly excluded by §5.1. Without a captured declaration there is no
    // structural link, so two 2339s in one file stay two roots.
    const report = detectCausality(
      [
        diagnostic({ primary: { file: "src/a.ts", line: 1, column: 1 } }),
        diagnostic({ primary: { file: "src/a.ts", line: 2, column: 1 } }),
      ],
      FACTS,
    );
    expect(report.groups).toEqual([]);
    expect(report.diagnostics.every((d) => d.role === "root")).toBe(true);
  });

  it("does not make a group of one", () => {
    const report = detectCausality([diagnostic({ subject: symbol("src/decl.ts", 3) })], FACTS);
    expect(report.groups).toEqual([]);
    expect(report.diagnostics[0]?.role).toBe("root");
    expect(report.diagnostics[0]?.group).toBeUndefined();
  });

  it("never drops a diagnostic, whatever it groups", () => {
    const input = [
      diagnostic({ subject: symbol("src/decl.ts", 3) }),
      diagnostic({ subject: symbol("src/decl.ts", 3) }),
      diagnostic(),
    ];
    const report = detectCausality(input, FACTS);
    expect(report.diagnostics.map((d) => d.id)).toEqual(input.map((d) => d.id));
  });
});

describe("causality · roles and ranking", () => {
  it("elects a member sitting on the cause as the group's root", () => {
    // Not observed on today's corpus, but the shape is honoured rather than
    // asserted away: the next fixture may well break the declaration itself.
    const cause = symbol("src/decl.ts", 3, 1);
    const onCause = diagnostic({
      subject: cause,
      primary: { file: "src/decl.ts", line: 3, column: 1 },
    });
    const elsewhere = diagnostic({ subject: cause });

    const report = detectCausality([onCause, elsewhere], FACTS);
    const byId = new Map(report.diagnostics.map((d) => [d.id, d]));

    expect(byId.get(onCause.id)?.role).toBe("root");
    expect(byId.get(elsewhere.id)?.role).toBe("derived");
    expect(byId.get(elsewhere.id)?.derivedFrom).toEqual([onCause.id]);
  });

  it("ranks groups by explanatory power, largest first", () => {
    const small = symbol("src/decl.ts", 3, 1, "Small");
    const large = symbol("src/decl.ts", 50, 1, "Large");
    const report = detectCausality(
      [
        diagnostic({ subject: small }),
        diagnostic({ subject: small }),
        diagnostic({ subject: large }),
        diagnostic({ subject: large }),
        diagnostic({ subject: large }),
      ],
      FACTS,
    );
    expect(report.groups.map((g) => g.members.length)).toEqual([3, 2]);
    expect(report.groups[0]?.cause.symbol.name).toBe("Large");
  });

  it("is deterministic, ids included", () => {
    const build = () => {
      counter = 0;
      const cause = symbol("src/decl.ts", 3, 1);
      return detectCausality(
        [diagnostic({ subject: cause }), diagnostic({ subject: cause })],
        FACTS,
      );
    };
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
  });

  it("is pure — it does not mutate its input", () => {
    counter = 0;
    const input = [diagnostic({ subject: symbol("src/decl.ts", 3) })];
    const before = JSON.stringify(input);
    detectCausality(input, FACTS);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("leaves facts empty and confidence high — enrichment is P2", () => {
    const { report } = analyse("partial-interface-rename");
    for (const diagnostic of report.diagnostics) {
      expect(diagnostic.facts).toEqual([]);
      expect(diagnostic.confidence).toBe("high");
      expect(diagnostic.restated).toBeUndefined();
    }
  });
});
