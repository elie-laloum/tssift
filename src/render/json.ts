import type { RenderInput } from "./index.js";

/**
 * The complete report. This is what the MCP server will consume, so it can
 * never be the poorer of the two formats: every field the text carries exists
 * here with the same meaning, plus the ones text drops — `id`, `snippet`, and
 * the full `ProgramFacts` (rule 14).
 *
 * Note what `diagnostics` is: **every diagnostic, always**, group members
 * included, whatever `--all` says. Declassing lives in the rendering, not in the
 * data (rule 2), so a consumer of json never has to pass a flag to see
 * everything. `groups` is the ranked index over that array, and `--all` only
 * records which mode produced the text alongside it.
 *
 * Deliberately not snapshot-tested: it carries the resolved compiler's absolute
 * path and version, which differ per machine and per matrix cell. §4 requires
 * both, and they are genuinely useful to a consumer; the text renderer is where
 * snapshot stability is bought.
 */
export function renderJson(input: RenderInput): string {
  const { diagnostics, groups } = input.report;
  const { facts } = input;

  const errors = diagnostics.filter((d) => d.category === "error").length;
  const warnings = diagnostics.filter((d) => d.category === "warning").length;
  const filesWithDiagnostics = new Set(diagnostics.map((d) => d.primary.file)).size;
  const derived = diagnostics.filter((d) => d.role === "derived").length;

  return `${JSON.stringify(
    {
      root: input.rootLabel,
      all: input.all,
      // Recorded, never applied. json is the complete report (rule 14); the
      // budget constrains its `agent-text` sibling, and a consumer reading both
      // should be able to tell what the text was constrained to.
      budgetTokens: input.budgetTokens ?? null,
      typescript: facts.typescript,
      counts: {
        diagnostics: diagnostics.length,
        errors,
        warnings,
        filesWithDiagnostics,
        filesChecked: facts.files.length,
        groups: groups.length,
        derived,
      },
      groups,
      diagnostics,
      program: {
        files: facts.files,
        imports: facts.imports,
      },
    },
    null,
    2,
  )}\n`;
}
