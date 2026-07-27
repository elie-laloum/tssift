import type { NormalizedDiagnostic, ProgramFacts } from "../types.js";

export interface RenderInput {
  diagnostics: NormalizedDiagnostic[];
  facts: ProgramFacts;
  /**
   * How the root is printed. Relative to the current directory rather than
   * absolute, so a snapshot does not carry `/home/<user>/…` to its grave.
   * Computed by the caller — renderers stay pure.
   */
  rootLabel: string;
  /** `--all`. Nothing is declassed in P0, so it changes no output yet (rule 2). */
  all: boolean;
}

export type RenderFormat = "agent-text" | "json";

export const RENDER_FORMATS: readonly RenderFormat[] = ["agent-text", "json"];

export function isRenderFormat(value: string): value is RenderFormat {
  return (RENDER_FORMATS as readonly string[]).includes(value);
}

export function countErrors(diagnostics: readonly NormalizedDiagnostic[]): number {
  return diagnostics.filter((diagnostic) => diagnostic.category === "error").length;
}
