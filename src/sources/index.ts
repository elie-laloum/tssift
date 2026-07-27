import type { NormalizedDiagnostic, ProgramFacts } from "../types.js";

export interface LoadOptions {
  /**
   * Path to the tsconfig, or to the directory holding one. Taken as given —
   * there is no upward search. Determinism beats magic (PROJECT.md §9).
   */
  project: string;
  /**
   * Codes for which the source resolves a `DiagnosticContext`. The source knows
   * numbers, never enrichers — see `src/codes.ts`.
   */
  captureFor: readonly number[];
}

export interface SourceResult {
  diagnostics: NormalizedDiagnostic[];
  facts: ProgramFacts;
}

/**
 * The only layer allowed to see `typescript`. Everything the pipeline could
 * ever need is captured here, on two channels: `NormalizedDiagnostic.context`
 * per diagnostic, and `ProgramFacts` per program (rule 4).
 */
export interface DiagnosticSource {
  load(options: LoadOptions): SourceResult;
}
