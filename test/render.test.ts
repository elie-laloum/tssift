import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONTEXT_CAPTURE_CODES } from "../src/codes.js";
import { renderAgentText } from "../src/render/agent-text.js";
import type { RenderInput } from "../src/render/index.js";
import { renderJson } from "../src/render/json.js";
import { TsApiSource } from "../src/sources/ts-api.js";

const FIXTURES = [
  "partial-interface-rename",
  "two-independent-roots",
  "overload-mismatch",
] as const;

/**
 * Exact text snapshots are pinned to one TypeScript version. The raw message is
 * printed verbatim, so snapshots inherit TypeScript's wording — and that wording
 * moves between minors. Everywhere else in the matrix, only the tolerant
 * invariants below run (PROJECT.md §9.2).
 */
const SNAPSHOT_VERSION = "5.9.3";

function build(name: (typeof FIXTURES)[number], all = false): RenderInput {
  const project = fileURLToPath(new URL(`../fixtures/${name}/before`, import.meta.url));
  const { diagnostics, facts } = new TsApiSource().load({
    project,
    captureFor: CONTEXT_CAPTURE_CODES,
  });
  return { diagnostics, facts, rootLabel: relative(process.cwd(), facts.root) || ".", all };
}

const loadedVersion = build("two-independent-roots").facts.typescript.version;

describe.runIf(loadedVersion === SNAPSHOT_VERSION)(
  `agent-text · snapshots @ ts${SNAPSHOT_VERSION}`,
  () => {
    for (const name of FIXTURES) {
      it(`renders ${name}`, () => {
        expect(renderAgentText(build(name))).toMatchSnapshot();
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
        // as a continuation with no `[n]`, no chain indent and no `related`.
        if (line === "" || line.startsWith("root: ")) continue;
        expect(line).toMatch(/^(\d+ |\[\d+\] | {4,}(TS\d+: |related))/);
      }
    });

    it(`${name} · leaks no absolute path and no backslash`, () => {
      expect(text).not.toMatch(/(^|\s)\//m);
      expect(text).not.toMatch(/\\/);
    });

    it(`${name} · carries no id and no snippet`, () => {
      const { diagnostics } = build(name);
      for (const diagnostic of diagnostics) {
        expect(text).not.toContain(diagnostic.id);
        const snippet = diagnostic.primary.snippet;
        if (snippet && snippet.length > 12) expect(text).not.toContain(snippet);
      }
    });

    it(`${name} · is English, frame included`, () => {
      // A French frame around an English message would produce a bilingual
      // report, and rule 3 forbids translating the message (rule 13).
      expect(text).not.toMatch(/[éèêàçùôîï]/);
      expect(text).not.toMatch(/\b(erreur|fichier|racine|erreurs|fichiers)\b/);
    });

    it(`${name} · --all loses no diagnostic (rule 2)`, () => {
      const withAll = renderAgentText(build(name, true));
      const count = (value: string) => (value.match(/^\[\d+\] /gm) ?? []).length;
      expect(count(withAll)).toBeGreaterThanOrEqual(count(text));
      expect(count(text)).toBe(build(name).diagnostics.length);
    });
  }
});

describe("json is the complete report, agent-text a lossy projection (rule 14)", () => {
  for (const name of FIXTURES) {
    it(`${name} · every field of the text exists in json`, () => {
      const input = build(name);
      const text = renderAgentText(input);
      const json = JSON.parse(renderJson(input)) as {
        root: string;
        counts: { errors: number };
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

      for (const diagnostic of json.diagnostics) {
        const { file, line, column } = diagnostic.primary;
        expect(text).toContain(`${file}:${line}:${column}`);
        expect(text).toContain(`TS${diagnostic.code}: ${diagnostic.message}`);
        for (const node of diagnostic.chain) expect(text).toContain(`TS${node.code}: ${node.text}`);
        for (const related of diagnostic.related) expect(text).toContain(related.message);
      }
    });

    it(`${name} · json carries what the text drops`, () => {
      const json = JSON.parse(renderJson(build(name))) as {
        diagnostics: Array<{ id: string; primary: { snippet?: string } }>;
        program: { files: string[]; imports: Record<string, string[]> };
        typescript: { version: string; path: string };
      };
      for (const diagnostic of json.diagnostics) {
        expect(diagnostic.id).toMatch(/^[0-9a-f]{12}$/);
        expect(diagnostic.primary.snippet).toBeTruthy();
      }
      expect(json.program.files.length).toBeGreaterThan(0);
      expect(json.typescript.version).toMatch(/^5\./);
    });
  }
});
