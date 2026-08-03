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
  /**
   * Required members of `expected` that the supplied type does not have.
   *
   * Only TS2739/2740/2741 fill it, and only TS2740 has a reader for it: that is
   * the one code where TypeScript truncates its own list (at four, from six
   * missing upwards). On 2739 and 2741 the message is already complete, so this
   * field exists there and is deliberately unused (PROJECT.md §4, §5.2).
   */
  missing?: string[];
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
  /**
   * How module specifiers resolve in this project — declared dependencies,
   * installer, PnP, `paths`. The channel TS2307 needs and that no
   * `NormalizedDiagnostic` can carry: the message is identical under all four
   * installers while the truth behind it is not (PROJECT.md §4, §9.1).
   */
  resolution: ResolutionFacts;
  /** The compiler actually loaded. */
  typescript: { version: string; path: string };
}

/** Which installer wrote the lockfile. `unknown` when none, or more than one, is found. */
export type Installer = "npm" | "pnpm" | "yarn" | "bun" | "unknown";

export interface DeclaredDependency {
  /** `dependencies` | `devDependencies` | `peerDependencies` | `optionalDependencies`. */
  field: string;
  /** The range exactly as written in package.json. */
  range: string;
}

/**
 * What the project's declarative files say about module resolution.
 *
 * Filled by the source, from files only — never a package manager, never a
 * subprocess, and never presuming `node_modules/` exists (rule 10). Every field
 * is something that was looked for and found, or looked for and not found.
 */
export interface ResolutionFacts {
  installer: Installer;
  /** Lockfile names found at the project root, in a fixed order. */
  lockfiles: string[];
  /** `.pnp.cjs` (or the Yarn 2 `.pnp.js`) sits at the project root. */
  pnp: boolean;
  /** A `node_modules/` directory exists at the project root. Under PnP it does not. */
  nodeModules: boolean;
  /**
   * package.json's declared dependencies, merged across the four fields.
   * **Absent** when no manifest could be read — which is not the same as one
   * declaring nothing, and only the latter licenses saying a package is missing.
   */
  dependencies?: Record<string, DeclaredDependency>;
  /** tsconfig `paths`, verbatim. Empty when none are configured. */
  paths: Record<string, readonly string[]>;
  /** `baseUrl`, relative to the tsconfig's directory. Absent when not configured. */
  baseUrl?: string;
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
 * A discriminated union. The `declaration` arm is the common case: every member
 * points at the same declaration. The other two arms exist because their cause
 * is an *absence*, and an absence has no declaration to point at:
 *
 * - `module` is TS2307's — an unresolved specifier, keyed on the specifier string.
 * - `name` is TS2304/TS2552's — an identifier that resolves to nothing, keyed on
 *   the name **and the file**. Unlike a module specifier, which means the same
 *   package everywhere, an identifier is scope-local: the same missing name in
 *   two files is two causes and may take two different fixes (§5.1).
 */
export type GroupCause =
  | {
      kind: "declaration";
      /** The declaration every member points at. `symbol.declaredAt` is the group key. */
      symbol: SymbolRef;
    }
  | {
      kind: "module";
      /** The unresolved specifier every member imports, as written. It is the group key. */
      specifier: string;
    }
  | {
      kind: "name";
      /** The identifier every member fails to resolve, as TypeScript printed it. */
      name: string;
      /**
       * The file the members live in. Part of the key, not decoration: a name is
       * scope-local, so `name` alone would merge two files' causes into one.
       */
      file: string;
    };

export interface DiagnosticGroup {
  /**
   * First 12 hex of a sha256, same discipline as `id`. The key depends on the
   * cause arm: `declaration` → `kind|file|line|column`, `module` → `module|specifier`,
   * `name` → `name|file|identifier`.
   */
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
