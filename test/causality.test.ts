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
import type {
  DiagnosticGroup,
  NormalizedDiagnostic,
  ProgramFacts,
  SymbolRef,
} from "../src/types.js";

function analyse(name: string) {
  const project = fileURLToPath(new URL(`../fixtures/${name}/before`, import.meta.url));
  const { diagnostics, facts } = new TsApiSource().load({
    project,
    captureFor: CONTEXT_CAPTURE_CODES,
  });
  return { report: detectCausality(diagnostics, facts), raw: diagnostics, facts };
}

/** Narrows a group's cause to the declaration arm — and asserts it, for the many tests that read `.symbol`. */
function declSymbolOf(group: DiagnosticGroup | undefined): SymbolRef {
  if (group?.cause.kind !== "declaration") {
    throw new Error(`expected a declaration cause, got ${group?.cause.kind ?? "no group"}`);
  }
  return group.cause.symbol;
}

/* ------------------------------------------------------------------ */
/* Synthetic fixtures, for the cases no real project produces on demand */
/* ------------------------------------------------------------------ */

const FACTS: ProgramFacts = {
  root: "/nowhere",
  files: ["src/a.ts", "src/b.ts", "src/decl.ts"],
  imports: {},
  resolution: { installer: "unknown", lockfiles: [], pnp: false, nodeModules: false, paths: {} },
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

describe("causality · phantom-dependency-pnpm (TS2307 folds on the specifier)", () => {
  // The two-imports-one-fails case. src/api-client.ts imports `@acme/http`
  // (resolves) AND `qs` (does not). The rule must fold the three `qs` failures
  // and never touch `@acme/http` — proof the key is the specifier, not the file.
  const { report } = analyse("phantom-dependency-pnpm");

  it("forms one module group on 'qs', three members", () => {
    expect(report.groups).toHaveLength(1);
    const cause = report.groups[0]?.cause;
    expect(cause?.kind).toBe("module");
    if (cause?.kind !== "module") throw new Error("expected a module cause");
    expect(cause.specifier).toBe("qs");
    expect(report.groups[0]?.members).toHaveLength(3);
  });

  it("never mentions the specifier that resolves", () => {
    const specifiers = report.groups.flatMap((g) =>
      g.cause.kind === "module" ? [g.cause.specifier] : [],
    );
    expect(specifiers).not.toContain("@acme/http");
  });

  it("marks every member derived, none root, all TS2307", () => {
    expect(report.diagnostics.every((d) => d.code === 2307)).toBe(true);
    expect(report.diagnostics.every((d) => d.role === "derived")).toBe(true);
    expect(report.diagnostics.every((d) => d.derivedFrom.length === 0)).toBe(true);
    expect(new Set(report.diagnostics.map((d) => d.group)).size).toBe(1);
  });
});

describe("causality · wrong-tsconfig-paths (one group per specifier, never one for all)", () => {
  // Four TS2307: three on `@domain/order`, one on `@domain/customer`. The shared
  // upstream cause (the `paths` line) is in no program file, so the rule keys on
  // the specifier: `@domain/order` folds 3→1, `@domain/customer` stays a lone
  // root under MIN_GROUP_SIZE. Grouping all four together would merge two aliases.
  const { report } = analyse("wrong-tsconfig-paths");

  it("folds only the specifier with two or more sites", () => {
    expect(report.groups).toHaveLength(1);
    const cause = report.groups[0]?.cause;
    if (cause?.kind !== "module") throw new Error("expected a module cause");
    expect(cause.specifier).toBe("@domain/order");
    expect(report.groups[0]?.members).toHaveLength(3);
  });

  it("leaves the lone specifier ungrouped — never merged with the other", () => {
    const ungrouped = report.diagnostics.filter((d) => d.group === undefined);
    expect(ungrouped).toHaveLength(1);
    expect(ungrouped[0]?.message).toContain("@domain/customer");
    expect(ungrouped[0]?.role).toBe("root");
  });

  it("renders as two entries, not one", () => {
    // One folded group plus one lone root = two things the agent reads.
    const grouped = report.groups.length;
    const lone = report.diagnostics.filter((d) => d.group === undefined).length;
    expect(grouped + lone).toBe(2);
  });
});

describe("causality · yarn-pnp-project (folds at the library, independent of the CLI guard)", () => {
  // The T2 PnP refusal lives in run.ts, not the source, so the library still
  // folds this fixture — which is what makes the 3→1 measurable in the eval.
  const { report } = analyse("yarn-pnp-project");

  it("folds three '@acme/http' failures into one module group", () => {
    expect(report.groups).toHaveLength(1);
    const cause = report.groups[0]?.cause;
    if (cause?.kind !== "module") throw new Error("expected a module cause");
    expect(cause.specifier).toBe("@acme/http");
    expect(report.groups[0]?.members).toHaveLength(3);
  });
});

describe("causality · two-roots-one-file (the harder negative control)", () => {
  // Two independent causes in ONE file under ONE code (TS2339): the case where
  // §5.1 rule 3 ("same 2339 in the same file ⇒ one root") is most tempting to
  // apply and most destructive if applied. Grouping keys on `declaredAt`, so the
  // two interfaces must yield two groups — folding within each, never across.
  const { report } = analyse("two-roots-one-file");

  it("splits into two groups on two distinct declarations, not one merged group", () => {
    expect(report.groups).toHaveLength(2);
    const causes = report.groups
      .map((g) => declSymbolOf(g))
      .sort((a, b) => a.name.localeCompare(b.name));
    expect(causes.map((s) => s.name)).toEqual(["Gauge", "Widget"]);
    expect(causes.every((s) => s.kind === "interface")).toBe(true);
    expect(causes.every((s) => s.declaredAt.file === "src/dashboard.ts")).toBe(true);
    // Distinct declaration sites — the reason they are not merged.
    expect(causes[0]?.declaredAt.line).not.toBe(causes[1]?.declaredAt.line);
  });

  it("folds two diagnostics under each cause, all TS2339", () => {
    for (const group of report.groups) {
      expect(group.members).toHaveLength(2);
    }
    expect(report.diagnostics).toHaveLength(4);
    expect(report.diagnostics.every((d) => d.code === 2339)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* TS2304 / TS2552 — the name-keyed rule (2026-08-04)                   */
/* ------------------------------------------------------------------ */

/** Narrows a group's cause to the `name` arm, the way `declSymbolOf` does for declarations. */
function nameCauseOf(group: DiagnosticGroup | undefined): { name: string; file: string } {
  if (group?.cause.kind !== "name") {
    throw new Error(`expected a name cause, got ${group?.cause.kind ?? "no group"}`);
  }
  return group.cause;
}

/** A TS2304 whose snippet contains the name — the shape the guards expect to pass. */
function missing(
  name: string,
  file = "src/a.ts",
  overrides: Partial<NormalizedDiagnostic> = {},
): NormalizedDiagnostic {
  return diagnostic({
    code: 2304,
    message: `Cannot find name '${name}'.`,
    primary: { file, line: 1, column: 1, snippet: `const x: ${name} = 1;` },
    ...overrides,
  });
}

describe("causality · cannot-find-name (the name-keyed rule)", () => {
  const { report } = analyse("cannot-find-name");

  it("folds seven references to one missing name into a single group", () => {
    expect(report.diagnostics).toHaveLength(7);
    expect(report.groups).toHaveLength(1);
    expect(report.groups[0]?.members).toHaveLength(7);
    expect(report.diagnostics.every((d) => d.code === 2304)).toBe(true);
  });

  it("heads the group with the name and the file, and with no declaration", () => {
    // The cause is an absence: there is no `declaredAt` anywhere to point at,
    // which is why this arm exists rather than reusing the declaration one.
    expect(nameCauseOf(report.groups[0])).toEqual({
      kind: "name",
      name: "Cents",
      file: "src/billing/invoice.ts",
    });
  });

  it("marks every member derived — none can sit on a cause that does not exist", () => {
    expect(report.diagnostics.every((d) => d.role === "derived")).toBe(true);
    expect(report.diagnostics.every((d) => d.derivedFrom.length === 0)).toBe(true);
  });
});

describe("causality · two-missing-names-one-file (the name rule's negative control)", () => {
  // Two missing names in ONE file, and TypeScript reports them under two codes
  // only because a close candidate is in scope for one of them. Keying on the
  // file — or on file + code, which §5.1 excludes — would merge them.
  const { report } = analyse("two-missing-names-one-file");

  it("splits into two groups on two distinct names, not one merged group", () => {
    expect(report.diagnostics).toHaveLength(5);
    expect(report.groups).toHaveLength(2);
    const causes = report.groups
      .map((g) => nameCauseOf(g))
      .sort((a, b) => a.name.localeCompare(b.name));
    expect(causes.map((c) => c.name)).toEqual(["Cents", "TaxRates"]);
    expect(causes.every((c) => c.file === "src/pricing.ts")).toBe(true);
  });

  it("folds TS2552 exactly as it folds TS2304 — the 2724 lesson, for names", () => {
    // Which code TypeScript emits depends on whether a close name happens to be
    // in scope, not on the failure. If only 2304 were handled, this cascade would
    // fold or not according to the analysed author's spelling.
    const byName = new Map(report.groups.map((g) => [nameCauseOf(g).name, g]));
    expect(byName.get("Cents")?.members).toHaveLength(3);
    expect(byName.get("TaxRates")?.members).toHaveLength(2);
    const codes = new Set(report.diagnostics.filter((d) => d.code === 2552).map((d) => d.group));
    expect(codes.size).toBe(1);
    expect(codes.has(byName.get("TaxRates")?.id)).toBe(true);
  });

  it("does not key on the line: line 23 carries one diagnostic of each group", () => {
    const online23 = report.diagnostics.filter((d) => d.primary.line === 23);
    expect(online23).toHaveLength(2);
    expect(new Set(online23.map((d) => d.group)).size).toBe(2);
  });
});

describe("causality · what the name rule must never do", () => {
  it("does not group the same missing name across two files", () => {
    // A module specifier means the same package from anywhere; an identifier is
    // scope-local. Two files missing `Cents` are two causes and may take two
    // different fixes, so the key is `(file, name)` and never the name alone.
    const report = detectCausality([missing("Cents", "src/a.ts"), missing("Cents", "src/b.ts")], {
      ...FACTS,
      files: ["src/a.ts", "src/b.ts"],
    });
    expect(report.groups).toEqual([]);
    expect(report.diagnostics.every((d) => d.role === "root")).toBe(true);
  });

  it("never keys on a TS2552 suggestion — the regex is anchored, and here is the proof", () => {
    // `Cannot find name 'X'. Did you mean 'Y'?` — an unanchored pattern would be
    // free to key on Y. Two diagnostics that share only the SUGGESTION must not
    // meet, and two that share the missing name must, whatever the suggestion.
    const suggest = (name: string, hint: string) =>
      diagnostic({
        code: 2552,
        message: `Cannot find name '${name}'. Did you mean '${hint}'?`,
        primary: { file: "src/a.ts", line: 1, column: 1, snippet: `const x: ${name} = 1;` },
      });

    expect(
      detectCausality([suggest("Aa", "Shared"), suggest("Bb", "Shared")], FACTS).groups,
    ).toEqual([]);

    const together = detectCausality([suggest("Aa", "One"), suggest("Aa", "Two")], FACTS);
    expect(together.groups).toHaveLength(1);
    expect(nameCauseOf(together.groups[0]).name).toBe("Aa");
  });

  it("does not group when the message template drifted", () => {
    // The parse is the only thing naming the key, so anything it cannot read as
    // a plain identifier leaves the diagnostic an isolated root — the same
    // discipline the 2307 rule applies to a specifier its imports table denies.
    const drifted = (message: string) =>
      diagnostic({
        code: 2304,
        message,
        primary: { file: "src/a.ts", line: 1, column: 1, snippet: "const x: Cents = 1;" },
      });
    for (const message of [
      "Could not find name 'Cents'.", // prefix moved
      "Cannot find name 'a.b'.", // not an identifier
      "Cannot find name ''.", // empty
      "The name 'Cents' cannot be found.", // reworded entirely
    ]) {
      expect(detectCausality([drifted(message), drifted(message)], FACTS).groups).toEqual([]);
    }
  });

  it("does not group when the snippet does not confirm the name", () => {
    // `snippet` is the source line captured at ingestion, so it is the one thing
    // available to check the message against the file it came from. Absent or
    // contradicting ⇒ isolated root, never a merge.
    const unconfirmed = (snippet?: string) =>
      diagnostic({
        code: 2304,
        message: "Cannot find name 'Cents'.",
        primary: { file: "src/a.ts", line: 1, column: 1, ...(snippet ? { snippet } : {}) },
      });
    expect(detectCausality([unconfirmed(), unconfirmed()], FACTS).groups).toEqual([]);
    expect(
      detectCausality(
        [unconfirmed("const x: Euros = 1;"), unconfirmed("const y: Euros = 2;")],
        FACTS,
      ).groups,
    ).toEqual([]);
  });

  it("leaves a lone missing name a root — a group of one is noise", () => {
    expect(detectCausality([missing("Cents")], FACTS).groups).toEqual([]);
  });

  it("does not reach codes it was not measured on", () => {
    // TS2503 (Cannot find namespace) and TS2686 (UMD global) are §5.1 roots too
    // and are deliberately out of scope: no fixture, no real-code witness, and a
    // different template. This test is what makes that a decision rather than an
    // oversight someone later "fixes" by widening the code list.
    const namespace = () =>
      diagnostic({
        code: 2503,
        message: "Cannot find namespace 'NS'.",
        primary: { file: "src/a.ts", line: 1, column: 1, snippet: "let x: NS.T;" },
      });
    expect(detectCausality([namespace(), namespace()], FACTS).groups).toEqual([]);
  });
});

describe("causality · partial-interface-rename", () => {
  const { report } = analyse("partial-interface-rename");

  it("folds three codes onto one declaration", () => {
    expect(report.groups).toHaveLength(1);
    expect(report.groups[0]?.members).toHaveLength(3);
  });

  it("heads the group with the declaration, not with a member", () => {
    expect(report.groups[0]?.cause.kind).toBe("declaration");
    const symbol = declSymbolOf(report.groups[0]);
    expect(symbol.name).toBe("CreateUserInput");
    expect(symbol.declaredAt.file).toBe("src/types/user.ts");
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
    const symbol = declSymbolOf(report.groups[0]);
    expect(symbol.kind).toBe("module");
    expect(symbol.declaredAt.file).toBe("src/domain/index.ts");
    expect(symbol.declaredAt.line).toBe(1);
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
    const symbol = declSymbolOf(report.groups[0]);
    expect(symbol.kind).toBe("function");
    expect(symbol.name).toBe("auditEvent");
    expect(symbol.declaredAt.file).toBe("src/audit/event.ts");
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
    const symbol = declSymbolOf(report.groups[0]);
    expect(symbol.kind).toBe("type-alias");
    expect(symbol.name).toBe("Shape");
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
  // Both fixtures below were single-cause cascades reported as lone roots — the
  // threshold working as specified, not a defect — and these tests existed so
  // that the day capture was extended, the change would surface as a failure
  // here rather than as a silent improvement nobody measured.
  //
  // It worked, twice. `missing-required-property` folded on 2026-08-02 when
  // 2739/2741 joined CONTEXT_CAPTURE_CODES, and `nullable-chain` on 2026-08-04
  // when 18047/18048/18049 did. Both tests below record what happened instead
  // of asserting it away, and this comment is the reason to keep writing them.

  it("nullable-chain · folds since 2026-08-04, and the reason it could not before was wrong", () => {
    // This test used to assert `groups: []` and `context === undefined`, on a
    // stated reason: "nothing capturable answers a control-flow question."
    // AGENTS.md, CLAUDE.md and codes.ts all said the same. It was half true.
    //
    // Control flow is what the §5.2 *payload* needs — where the value became
    // nullable, which branch guards it — and that is still underivable. The
    // causality link never needed it: the thing that is possibly null is a
    // declared symbol, and its declaration is the ordinary structural link
    // §5.1 rule 2 already allowed. Same shape as the 2322 milestone.
    const { report } = analyse("nullable-chain");
    expect(report.diagnostics).toHaveLength(4);
    expect(new Set(report.diagnostics.map((d) => d.code))).toEqual(new Set([18047]));
    expect(report.groups).toHaveLength(1);
    expect(report.groups[0]?.members).toHaveLength(4);

    // The line meta.json calls the root cause — and NOT `host`/`port`, which a
    // resolver that widened past the quoted expression would have reached.
    const symbol = declSymbolOf(report.groups[0]);
    expect(symbol.name).toBe("proxy");
    expect(symbol.declaredAt.file).toBe("src/config/settings.ts");
    expect(symbol.declaredAt.line).toBe(13);
  });

  it("private-fields-and-anonymous-nullish · the anonymous variant still does not fold", () => {
    // The other half of the same milestone, and the reason the family is
    // captured rather than the whole nullability space. An expression with no
    // printable name produces TS2531, which carries no quoted expression, so
    // the anchor the resolver checks itself against does not exist. One root,
    // no group, no context — permanently.
    const { report } = analyse("private-fields-and-anonymous-nullish");
    const anonymous = report.diagnostics.filter((d) => d.code === 2531);
    expect(anonymous).toHaveLength(1);
    expect(anonymous[0]?.role).toBe("root");
    expect(anonymous[0]?.context).toBeUndefined();
    expect(anonymous[0]?.group).toBeUndefined();
  });

  it("missing-required-property · folds since 2026-08-02, and NOT on the related span", () => {
    // This test used to assert `groups: []`, with a comment saying it existed so
    // that extending capture would surface as a failure here rather than as a
    // silent improvement. That is exactly what happened: 2739/2741 entered
    // CONTEXT_CAPTURE_CODES and the three sites now fold onto one interface.
    //
    // What it still guards is the sharper half, and it is worth more than the
    // fold. Every diagnostic here carries a related pointing at the missing
    // *property*, `profile.ts:10:3` — and the group key is the *interface*,
    // `profile.ts:7:1`. Two different positions. The fold rests on the captured
    // `expected.declaredAt`, never on the related, so design question 2 of the
    // P1 plan stays closed in the direction `assignability-mismatch` closed it.
    const { report } = analyse("missing-required-property");
    expect(report.groups).toHaveLength(1);
    expect(report.groups[0]?.members).toHaveLength(3);

    const cause = report.groups[0]?.cause;
    expect(cause?.kind).toBe("declaration");
    const declaredAt = cause?.kind === "declaration" ? cause.symbol.declaredAt : undefined;
    expect(declaredAt?.file).toBe("src/accounts/profile.ts");
    expect(declaredAt?.line).toBe(7);

    const spans = report.diagnostics.map((d) => d.related[0]?.span);
    expect(spans).toHaveLength(3);
    for (const span of spans) {
      expect(span?.file).toBe("src/accounts/profile.ts");
      // One and the same position, three times over — and still not the key.
      expect(span?.line).toBe(10);
      expect(span?.line).not.toBe(declaredAt?.line);
    }
  });
});

describe("causality · why a related span may NOT be used as a group key", () => {
  // Design question 2 of the P1 plan, answered with a counter-example rather
  // than with an argument. It was closed as "moot" when TS2554 turned out to
  // resolve through getResolvedSignature(); `missing-required-property` reopened
  // it by showing a related that DOES point at the cause. This one closes it for
  // good, in the other direction.
  const { report } = analyse("assignability-mismatch");

  it("folds all three on the contextual type — line 6, not the related's line 9", () => {
    // Since 2026-08-02 this fixture folds, and it folds onto exactly the line
    // `meta.json` calls the root cause: `type Currency` at currency.ts:6:1, the
    // union that lost "GBP". The related-keyed rule it was written to refute
    // would have reached line 9:3 and only two of the three.
    //
    // So the fixture now carries both halves of the argument rather than one:
    // the related is the wrong key, and the contextual type is a right one.
    expect(report.diagnostics).toHaveLength(3);
    expect(report.groups).toHaveLength(1);
    expect(report.groups[0]?.members).toHaveLength(3);

    const symbol = declSymbolOf(report.groups[0]);
    expect(symbol.name).toBe("Currency");
    expect(symbol.declaredAt.file).toBe("src/pricing/currency.ts");
    expect(symbol.declaredAt.line).toBe(6);
  });

  it("would have grouped two of three, and headed them with correct code", () => {
    const relatedSites = report.diagnostics.map((d) =>
      d.related[0]?.span
        ? `${d.related[0].span.file}:${d.related[0].span.line}:${d.related[0].span.column}`
        : undefined,
    );

    // Two carry a related; the third — a direct `const x: Currency = "GBP"` —
    // carries none, so a related-keyed rule could never reach it.
    expect(relatedSites.filter(Boolean)).toHaveLength(2);
    expect(new Set(relatedSites.filter(Boolean))).toEqual(new Set(["src/pricing/currency.ts:9:3"]));

    // And line 9 is `currency: Currency;` — the PROPERTY of `Rate`, which is
    // correct code the reader must not touch. The cause is line 6, the union
    // that lost "GBP". Grouping on the related would send the reader to a line
    // that needs no edit, which is the misdirection PROJECT.md §11 calls
    // critical — just quieter than merging two unrelated bugs.
    expect(new Set(relatedSites.filter(Boolean))).not.toContain("src/pricing/currency.ts:6:1");

    // And the group that DOES form is keyed nowhere near them.
    const keyed = declSymbolOf(report.groups[0]).declaredAt;
    expect(`${keyed.file}:${keyed.line}:${keyed.column}`).toBe("src/pricing/currency.ts:6:1");
    expect(relatedSites).not.toContain("src/pricing/currency.ts:6:1");
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
    //
    // This is the contrast case for the name-keyed rule above, and the reason
    // that rule is a narrow carve-out rather than a loosening: here the name IS
    // bound — twice, to different things — so shadowing is possible and the
    // exclusion holds. TS2304 is the opposite case, the compiler stating the
    // name is bound to nothing, where shadowing cannot occur. Default code
    // 2339, deliberately: the carve-out must not reach this test.
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
    // structural link, so two 2339s in one file stay two roots. The name-keyed
    // rule does not weaken this: it adds the missing *name* to the key, and only
    // for codes that assert the name resolves to nothing.
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
    expect(declSymbolOf(report.groups[0]).name).toBe("Large");
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
