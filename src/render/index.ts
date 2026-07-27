import type { DiagnosticReport, EnrichedDiagnostic, ProgramFacts } from "../types.js";

export interface RenderInput {
  /**
   * The pipeline's output: the complete diagnostic table plus the ranked group
   * index over it. Both, always — a renderer that received only the groups
   * could not honour `--all`, and one that received only the diagnostics could
   * not rank (rule 2, §5.1).
   */
  report: DiagnosticReport;
  facts: ProgramFacts;
  /**
   * How the root is printed. Relative to the current directory rather than
   * absolute, so a snapshot does not carry `/home/<user>/…` to its grave.
   * Computed by the caller — renderers stay pure.
   */
  rootLabel: string;
  /** `--all`: every diagnostic on a full line, ungrouped. Nothing is declassed. */
  all: boolean;
}

export type RenderFormat = "agent-text" | "json";

export const RENDER_FORMATS: readonly RenderFormat[] = ["agent-text", "json"];

export function isRenderFormat(value: string): value is RenderFormat {
  return (RENDER_FORMATS as readonly string[]).includes(value);
}

export function countErrors(diagnostics: readonly EnrichedDiagnostic[]): number {
  return diagnostics.filter((diagnostic) => diagnostic.category === "error").length;
}
