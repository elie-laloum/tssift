import type { RenderInput } from "./index.js";

/**
 * The complete report. This is what the MCP server will consume, so it can
 * never be the poorer of the two formats: every field the text carries exists
 * here with the same meaning, plus the ones text drops — `id`, `snippet`, and
 * the full `ProgramFacts` (rule 14).
 *
 * Deliberately not snapshot-tested: it carries the resolved compiler's absolute
 * path and version, which differ per machine and per matrix cell. §4 requires
 * both, and they are genuinely useful to a consumer; the text renderer is where
 * snapshot stability is bought.
 */
export function renderJson(input: RenderInput): string {
  const { diagnostics, facts } = input;

  const errors = diagnostics.filter((d) => d.category === "error").length;
  const warnings = diagnostics.filter((d) => d.category === "warning").length;
  const filesWithDiagnostics = new Set(diagnostics.map((d) => d.primary.file)).size;

  return `${JSON.stringify(
    {
      root: input.rootLabel,
      all: input.all,
      typescript: facts.typescript,
      counts: {
        diagnostics: diagnostics.length,
        errors,
        warnings,
        filesWithDiagnostics,
        filesChecked: facts.files.length,
      },
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
