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
  /** File → resolved specifiers. This channel is what makes "2307 ⇒ importers are derived" decidable. */
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
  role: "root" | "derived";
  /** ids of the root diagnostics. */
  derivedFrom: string[];
  /** Verifiable facts, never an imperative (rule 1). */
  facts: Fact[];
  /** 'low' ⇒ fall back to the native format. Degrading beats inventing (rule 5). */
  confidence: "high" | "low";
  /** H2. Empty until the eval justifies it, code by code. */
  restated?: string;
}

export interface Fact {
  kind: "declaration" | "near-match" | "members" | "overloads" | "origin";
  text: string;
  span?: SourceSpan;
}
