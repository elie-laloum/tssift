import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONTEXT_CAPTURE_CODES } from "../src/codes.js";
import { dedupe, detectCausality, enrich } from "../src/pipeline/index.js";
import { renderAgentText } from "../src/render/agent-text.js";
import type { RenderInput } from "../src/render/index.js";
import { renderJson } from "../src/render/json.js";
import { TsApiSource } from "../src/sources/ts-api.js";

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

/**
 * Exact text snapshots are pinned to one TypeScript version. The raw message is
 * printed verbatim, so snapshots inherit TypeScript's wording — and that wording
 * moves between minors. Everywhere else in the matrix, only the tolerant
 * invariants below run (PROJECT.md §9.2).
 */
const SNAPSHOT_VERSION = "5.9.3";

/** The same composition `run.ts` performs, so tests exercise the shipped product. */
function build(name: (typeof FIXTURES)[number], all = false): RenderInput {
  const project = fileURLToPath(new URL(`../fixtures/${name}/before`, import.meta.url));
  const { diagnostics, facts } = new TsApiSource().load({
    project,
    captureFor: CONTEXT_CAPTURE_CODES,
  });
  const report = enrich(detectCausality(dedupe(diagnostics, facts), facts), facts);
  return { report, facts, rootLabel: relative(process.cwd(), facts.root) || ".", all };
}

/** Raw diagnostics as the source produced them — the yardstick rule 2 is measured against. */
function ingested(name: (typeof FIXTURES)[number]) {
  const project = fileURLToPath(new URL(`../fixtures/${name}/before`, import.meta.url));
  return new TsApiSource().load({ project, captureFor: CONTEXT_CAPTURE_CODES }).diagnostics;
}

const loadedVersion = build("two-independent-roots").facts.typescript.version;

describe.runIf(loadedVersion === SNAPSHOT_VERSION)(
  `agent-text · snapshots @ ts${SNAPSHOT_VERSION}`,
  () => {
    for (const name of FIXTURES) {
      it(`renders ${name}`, () => {
        expect(renderAgentText(build(name))).toMatchSnapshot();
      });

      it(`renders ${name} with --all`, () => {
        expect(renderAgentText(build(name, true))).toMatchSnapshot();
      });
    }
  },
);

describe("agent-text · invariants (any supported TypeScript)", () => {
  for (const name of FIXTURES) {
    const text = renderAgentText(build(name));

    it(`${name} · opens with the root and a summary`, () => {
      const [first, second] = text.split("\n");
      expect(first).toMatch(/^root: /);
      expect(second).toMatch(/^\d+ errors? · \d+ files?/);
    });

    it(`${name} · never folds a diagnostic line`, () => {
      for (const line of text.split("\n")) {
        // Every rendered line is a whole line: a wrapped message would show up
        // as a continuation matching none of the shapes below.
        if (line === "" || line.startsWith("root: ")) continue;
        // The alternation is an allow-list on purpose: a wrapped message shows
        // up as a continuation matching none of these. P2 added four shapes —
        // a cause's property/export list, a cause's rendered signature (which
        // opens on `(` or `{`), a diagnostic's `<label>: <kind> 'name' at …`,
        // and its `'name' has N properties: …` — and the 2307 enricher three
        // more, all statements about a specifier rather than about a type:
        // `'x' is/matches …`, `installer:`/`lockfiles:`, and the `no
        // node_modules …` line — then 2740 two: `required by:` and the
        // `N more not listed above:` completion — and 2322 one, a union of
        // primitives expanded as `"EUR" | "USD"`, which is the only fact line
        // that opens on a quoted literal. Widening this to `.*` would retire
        // the guard rather than update it.
        expect(line).toMatch(
          /^(\d+ |\[\d+\] | {2,}(TS\d+: |related|cause: |\d+ diagnostics?, |\+\d+ more site|\S+:\d+:\d+ |\d+ (propert(y|ies)|exports?): |'[^']+' (has \d+ |is (not )?declared |matches )|'\.pnp\.cjs' |no node_modules |"[^"]*" \||\d+ more not listed above: |(type|expected type|parameter type|callee|module|installer|lockfiles|required by): |[({]))/,
        );
      }
    });

    it(`${name} · leaks no absolute path and no backslash`, () => {
      expect(text).not.toMatch(/(^|\s)\//m);
      expect(text).not.toMatch(/\\/);
    });

    it(`${name} · carries no id and no snippet`, () => {
      for (const diagnostic of build(name).report.diagnostics) {
        expect(text).not.toContain(diagnostic.id);
        const snippet = diagnostic.primary.snippet;
        if (snippet && snippet.length > 12) expect(text).not.toContain(snippet);
      }
    });

    it(`${name} · is English, frame included`, () => {
      // A French frame around an English message would produce a bilingual
      // report, and rule 3 forbids translating the message (rule 13).
      expect(text).not.toMatch(/[éèêàçùôîï]/);
      expect(text).not.toMatch(/\b(erreur|fichier|racine|erreurs|fichiers|cause racine)\b/);
    });

    it(`${name} · the frame carries no imperative (rule 1)`, () => {
      // The frame is everything tssift wrote itself: the summary, the cause
      // header, the counters. Excluded from the scan: any line carrying a TS
      // message or a `related`, which are quoted verbatim and which rule 3
      // forbids touching, and the `root:` line, which is a path.
      //
      // Word boundaries matter here and the naive version of this test was
      // wrong twice over: `fix` matches "fixtures" and `use ` matches "cause ".
      // A prescription test that cries wolf gets deleted, so it has to be exact.
      const frame = text
        .split("\n")
        .filter(
          (line) =>
            !/\bTS\d+: /.test(line) && !/^\s*related /.test(line) && !line.startsWith("root: "),
        )
        .join(" ");

      const imperative =
        /\b(add|change|should|shall|try|use|fix|correct|replace|must|need|remove|rename|make|set|check|ensure|consider)\b/i;
      expect(frame).not.toMatch(imperative);
    });
  }
});

describe("rule 2 · --all restores every diagnostic, always", () => {
  for (const name of FIXTURES) {
    it(`${name} · --all prints exactly as many entries as the source produced`, () => {
      const entries = (value: string) => (value.match(/^\[\d+\] /gm) ?? []).length;
      expect(entries(renderAgentText(build(name, true)))).toBe(ingested(name).length);
    });

    it(`${name} · grouping loses no diagnostic from the table`, () => {
      // The half of rule 2 that is easy to lose: declassing must be a property
      // of the rendering, so the table itself is untouched whatever the mode.
      const raw = ingested(name);
      for (const all of [false, true]) {
        const { diagnostics } = build(name, all).report;
        expect(diagnostics.map((d) => d.id).sort()).toEqual(raw.map((d) => d.id).sort());
      }
    });

    it(`${name} · every grouped diagnostic still appears somewhere under --all`, () => {
      const withAll = renderAgentText(build(name, true));
      for (const diagnostic of build(name).report.diagnostics) {
        const site = `${diagnostic.primary.file}:${diagnostic.primary.line}:${diagnostic.primary.column}`;
        expect(withAll).toContain(site);
      }
    });
  }
});

describe("json is the complete report, agent-text a lossy projection (rule 14)", () => {
  for (const name of FIXTURES) {
    it(`${name} · every field of the text exists in json`, () => {
      const input = build(name);
      const text = renderAgentText(input);
      // The per-diagnostic comparison below runs against the --all rendering,
      // where every diagnostic is printed by construction.
      //
      // It used to run against the default rendering, and that was wrong in a
      // way that hid until this fixture set grew: rule 14 says every field of
      // the TEXT exists in json, and checking each json diagnostic against the
      // text asserts the reverse inclusion. The default rendering caps a group
      // at MAX_SHOWN_MEMBERS and declasses the rest behind a counter, so the
      // reverse inclusion is FALSE by design (rule 2 — declassing is a property
      // of the rendering). The old test passed only because no committed
      // fixture had more than three members; `arity-changed` has four.
      const shown = renderAgentText(build(name, true));
      const json = JSON.parse(renderJson(input)) as {
        root: string;
        counts: { errors: number; groups: number };
        groups: Array<{
          cause:
            | { kind: "declaration"; symbol: { name: string; declaredAt: { file: string } } }
            | { kind: "module"; specifier: string };
        }>;
        diagnostics: Array<{
          id: string;
          code: number;
          message: string;
          primary: { file: string; line: number; column: number; snippet?: string };
          chain: Array<{ text: string; code: number; depth: number }>;
          related: Array<{ message: string }>;
        }>;
      };

      expect(text).toContain(`root: ${json.root}`);

      // Group headers rendered in text must be findable in json — this is the
      // direction rule 14 forbids reversing. A module cause names its specifier
      // and no declaration site; a declaration cause names its symbol and file.
      for (const group of json.groups) {
        if (group.cause.kind === "module") {
          expect(text).toContain(`'${group.cause.specifier}'`);
        } else {
          expect(text).toContain(`'${group.cause.symbol.name}'`);
          expect(text).toContain(group.cause.symbol.declaredAt.file);
        }
      }

      for (const diagnostic of json.diagnostics) {
        const { file, line, column } = diagnostic.primary;
        expect(shown).toContain(`${file}:${line}:${column}`);
        expect(shown).toContain(`TS${diagnostic.code}: ${diagnostic.message}`);
        for (const node of diagnostic.chain)
          expect(shown).toContain(`TS${node.code}: ${node.text}`);
        for (const related of diagnostic.related) expect(shown).toContain(related.message);
      }
    });

    it(`${name} · nothing the default rendering prints is absent from json`, () => {
      // The direction rule 14 actually states, asserted on its own rather than
      // as a side effect: every site the default text prints must exist in the
      // json table, whatever the cap did to the others.
      const input = build(name);
      const json = JSON.parse(renderJson(input)) as {
        diagnostics: Array<{ primary: { file: string; line: number; column: number } }>;
      };
      const sites = new Set(
        json.diagnostics.map((d) => `${d.primary.file}:${d.primary.line}:${d.primary.column}`),
      );
      const printed =
        renderAgentText(input)
          .match(/^ {4}(\S+:\d+:\d+) error TS/gm)
          ?.map((line) => line.trim()) ?? [];
      for (const line of printed) {
        expect(sites).toContain(line.split(" ")[0]);
      }
    });

    it(`${name} · json carries what the text drops`, () => {
      const json = JSON.parse(renderJson(build(name))) as {
        diagnostics: Array<{
          id: string;
          role: string;
          derivedFrom: string[];
          primary: { snippet?: string };
        }>;
        program: { files: string[]; imports: Record<string, string[]> };
        typescript: { version: string; path: string };
      };
      for (const diagnostic of json.diagnostics) {
        expect(diagnostic.id).toMatch(/^[0-9a-f]{12}$/);
        expect(diagnostic.primary.snippet).toBeTruthy();
        expect(["root", "derived"]).toContain(diagnostic.role);
      }
      expect(json.program.files.length).toBeGreaterThan(0);
      expect(json.typescript.version).toMatch(/^5\./);
    });

    it(`${name} · json holds the whole table even under --all`, () => {
      const withAll = JSON.parse(renderJson(build(name, true))) as {
        all: boolean;
        diagnostics: unknown[];
      };
      expect(withAll.all).toBe(true);
      expect(withAll.diagnostics).toHaveLength(ingested(name).length);
    });
  }
});
