/**
 * The data model, transcribed from PROJECT.md §4. That section is the source of
 * truth; this file is its literal transcription and nothing else.
 *
 * If a field is missing for a task, it gets added to PROJECT.md §4 in the same
 * change, with its reason. Never the other way round.
 *
 * This module imports nothing — least of all `typescript`. The shape below is
 * dimensioned on the TS 7 `Diagnostic`, the poorer of the two APIs, so that
 * `Ts7ApiSource` can be added later instead of forcing a rewrite (rule 4).
 */

export interface SourceSpan {
  /** Relative to the resolved tsconfig's directory, POSIX separators, never absolute. */
  file: string;
  /** 1-indexed. The TS API hands out 0-indexed offsets; conversion happens once, at ingestion. */
  line: number;
  /** 1-indexed. */
  column: number;
  endLine?: number;
  endColumn?: number;
  /** The source line, trimmed. Always captured, never rendered in text — json only. */
  snippet?: string;
}

export interface RelatedInfo {
  /** Optional: in TS 7 a related entry may carry no `fileName` at all. */
  span?: SourceSpan;
  /** The related text. This is the useful information, not the position. */
  message: string;
  code?: number;
}

export interface MessageChainNode {
  text: string;
  /** A leaf's code is not the root's: a 2769 chain typically ends on a 2345. */
  code: number;
  /** Prefix traversal + depth is a lossless encoding of an ordered tree. */
  depth: number;
}

export interface DiagnosticContext {
  /** The symbol at fault. */
  subject?: SymbolRef;
  /** Expected type, and where it is declared. */
  expected?: SymbolRef;
  /** Supplied type. */
  actual?: string;
}

export interface NormalizedDiagnostic {
  /** sha256(code|file|line|col|message), first 12 hex. Deterministic for identical input — nothing more. */
  id: string;
  code: number;
  category: "error" | "warning" | "suggestion" | "message";
  primary: SourceSpan;
  /** The raw TS message, NEVER altered (traceability, rule 3). */
  message: string;
  /** The messageText tree flattened, depth preserved. */
  chain: MessageChainNode[];
  /** relatedInformation — often where the real information lives. */
  related: RelatedInfo[];
  /** Filled by the SOURCE, never by the pipeline (rule 4). */
  context?: DiagnosticContext;
}

export interface ProgramFacts {
  /** The resolved tsconfig's directory, absolute. */
  root: string;
  /** Relative to `root`. */
  files: string[];
  /**
   * File → specifiers **as written**, resolved or not. This channel is what makes
   * "2307 ⇒ importers are derived" decidable — a module that does not resolve has
   * no resolution to index, so a table of successful resolutions could not answer
   * the question the rule asks (PROJECT.md §4).
   */
  imports: Record<string, string[]>;
  /** The compiler actually loaded. */
  typescript: { version: string; path: string };
}

export interface SymbolRef {
  name: string;
  /** 'interface' | 'function' | 'variable' | … */
  kind: string;
  declaredAt: SourceSpan;
  /** For object types. */
  memberNames?: string[];
  /** Text rendering of the type, truncated. */
  signature?: string;
}

export interface EnrichedDiagnostic extends NormalizedDiagnostic {
  /**
   * 'derived' means "explained by something else" — by a root diagnostic, or by
   * a group cause that is not itself a diagnostic.
   *
   * The second case is not exotic: measured on the corpus (2026-07-27), it is
   * the ONLY one that occurs. Renaming a field or changing an arity produces a
   * cascade of usage-site errors while the declaration that caused them stays
   * perfectly valid TypeScript, so there is no diagnostic to be derived *from*.
   */
  role: "root" | "derived";
  /**
   * ids of the root diagnostics. Empty when the cause is a declaration carrying
   * no diagnostic of its own — `group` is what carries the link there.
   */
  derivedFrom: string[];
  /** Id of the `DiagnosticGroup` this belongs to; absent when it belongs to none. */
  group?: string;
  /** Verifiable facts, never an imperative (rule 1). */
  facts: Fact[];
  /** 'low' ⇒ fall back to the native format. Degrading beats inventing (rule 5). */
  confidence: "high" | "low";
  /** H2. Empty until the eval justifies it, code by code. */
  restated?: string;
}

/**
 * What the members of a group share.
 *
 * A discriminated union with one arm today. The second arm is already named and
 * dated: TS2307 groups by an *unresolved* module specifier, which by definition
 * has no declaration to point at, so it cannot reuse this one.
 */
export type GroupCause = {
  kind: "declaration";
  /** The declaration every member points at. `symbol.declaredAt` is the group key. */
  symbol: SymbolRef;
};

export interface DiagnosticGroup {
  /** sha256(kind|file|line|column) of the cause, first 12 hex — same discipline as `id`. */
  id: string;
  cause: GroupCause;
  /** Member diagnostic ids, in report order. Never fewer than two. */
  members: string[];
}

/**
 * What the pipeline hands the renderers.
 *
 * The two fields are not alternatives, and that is the point. `diagnostics` is
 * the complete table — every diagnostic the source produced, nothing removed
 * (rule 2). `groups` is a *rendering index over it*, never a substitute for it.
 * Declassing is therefore a property of the rendering, not of the data, which is
 * what makes "`--all` restores everything" true by construction instead of by
 * discipline.
 */
export interface DiagnosticReport {
  diagnostics: EnrichedDiagnostic[];
  /** Ranked by explanatory power: most members first (§5.1). */
  groups: DiagnosticGroup[];
}

export interface Fact {
  kind: "declaration" | "near-match" | "members" | "overloads" | "origin";
  text: string;
  span?: SourceSpan;
}
