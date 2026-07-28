/**
 * Causality detection — the highest-value component, and the easiest to make
 * wrong (PROJECT.md §5.1).
 *
 * ## The threshold, and why it is this strict
 *
 * A diagnostic may be attached to a cause **only on a structural link present in
 * the captured data**, never on a resemblance. Excluded by name: Levenshtein
 * distance, "the same identifier", "the same file and the same code". The one
 * link this file uses is an **identical `declaredAt`** — two diagnostics whose
 * captured context points at the very same declaration, character for character.
 *
 * The asymmetry is deliberate. Under-grouping costs part of H1's number.
 * Over-grouping hides a real error behind a counter and sends the agent to edit
 * the wrong file, which is the failure PROJECT.md §11 classes as *critical*. So:
 * we loosen later, with numbers; we do not tighten after a miss.
 *
 * ## A cause is usually not a diagnostic
 *
 * Measured on the corpus and the fixtures (2026-07-27): in **every** group
 * observed, not one member sits on its own cause. Rename a field, change an
 * arity — the declaration stays valid TypeScript and every *use* of it fails. So
 * a group is headed by a declaration, and the model must say so; electing one
 * member as "the root" would have pointed the agent at a test file in 100 % of
 * measured cases.
 *
 * ## TS2307 — grouped by the unresolved specifier
 *
 * §5.1 names TS2307 a near-certain root, and the three installer/config fixtures
 * taught its shape. It is a cascade *of* 2307, not *from* one: an unresolved
 * import gives its bindings `any`, so nothing downstream errors — every
 * diagnostic is itself a 2307. And an unresolved module has no declaration to
 * key on, so the link is the **specifier** (`'qs'`, `'@domain/order'`), read
 * from the verbatim message and confirmed against `ProgramFacts.imports` for the
 * failing file. That confirmation is the correctness guard: a specifier the
 * imports table does not carry — a message whose wording drifted, a form
 * `collectImports` skips — is left an isolated root rather than risking a merge.
 * Relative specifiers are never grouped: `./types` from two directories are two
 * modules, and folding them would be the §11-critical over-group.
 *
 * TS2305 needs none of this: its module *does* resolve, so it is already an
 * identical-`declaredAt` case (12/12 on the corpus).
 *
 * No `typescript` import here, ever (rule 4) — asserted by
 * `test/architecture.test.ts`.
 */
import { createHash } from "node:crypto";
import type {
  DiagnosticGroup,
  DiagnosticReport,
  EnrichedDiagnostic,
  NormalizedDiagnostic,
  ProgramFacts,
  SourceSpan,
  SymbolRef,
} from "../types.js";

/** A group of one is a header with nothing folded under it: noise, not a fold. */
const MIN_GROUP_SIZE = 2;

/** The comparable identity of a position. Identical string ⇒ identical site. */
function siteOf(span: SourceSpan): string {
  return `${span.file}:${span.line}:${span.column}`;
}

/** sha256(kind|site), first 12 hex — the same discipline as `NormalizedDiagnostic.id`. */
function groupId(cause: string, site: string): string {
  return createHash("sha256").update(`${cause}|${site}`).digest("hex").slice(0, 12);
}

/**
 * The single reference a diagnostic offers causality.
 *
 * `subject` first, then `expected`: `subject` is "the symbol at fault" and is
 * what 2339/2305/2554 populate, while `expected` carries the parameter or
 * contextual type of 2345/2353. Only one is ever consulted, so a diagnostic
 * belongs to at most one group and the report cannot double-count.
 */
function anchorOf(diagnostic: NormalizedDiagnostic): SymbolRef | undefined {
  return diagnostic.context?.subject ?? diagnostic.context?.expected;
}

/** The comparable identity of a cause, per arm — a total order for the ranking. */
function causeKey(group: DiagnosticGroup): string {
  return group.cause.kind === "module"
    ? `module|${group.cause.specifier}`
    : siteOf(group.cause.symbol.declaredAt);
}

/**
 * The unresolved module a TS2307 names — the key its group folds on.
 *
 * Read from the verbatim message (`Cannot find module 'X' …`, stable 5.4→5.9)
 * and only trusted when `ProgramFacts.imports` for the same file carries it. A
 * relative specifier is never returned: `./x` is file-relative, so the same
 * string from two directories is two different modules, and grouping them would
 * be the §11-critical over-group. Anything the imports table cannot confirm is
 * `undefined`, and the diagnostic stays an isolated root — never a merge.
 */
function unresolvedSpecifier(
  diagnostic: NormalizedDiagnostic,
  imports: ProgramFacts["imports"],
): string | undefined {
  const specifier = /module '([^']+)'/.exec(diagnostic.message)?.[1];
  if (!specifier || specifier.startsWith(".") || specifier.startsWith("/")) return undefined;
  return imports[diagnostic.primary.file]?.includes(specifier) ? specifier : undefined;
}

/**
 * May this declaration act as a cause?
 *
 * **No, if it lives outside the analysed program.** This guard is not
 * hypothetical: on `.corpus/lekes-result-value-renamed` a TS2345 resolves its
 * expected type to `<ts-lib>/lib.es2015.collection.d.ts` — `interface Map`.
 * Grouping on that would merge two entirely unrelated bugs the moment both
 * happened to mis-call a `Map` method, which is precisely the §11-critical
 * failure. The same reasoning covers `node_modules/`: a shared dependency's
 * declaration is not a shared *cause*, and it is not something the reader can
 * edit either.
 *
 * `ProgramFacts.files` is the authority rather than a prefix test on the path,
 * so the rule follows the program rather than a naming convention.
 */
function isOwnDeclaration(span: SourceSpan, ownFiles: ReadonlySet<string>): boolean {
  return ownFiles.has(span.file);
}

/**
 * Group diagnostics by the declaration they share, and mark roles.
 *
 * Pure, order-preserving, deterministic: buckets come out in the order their
 * first member appears in the input, and members keep the input's order. The
 * input is already sorted by the source, so nothing here leaks the compiler's
 * own ordering into a snapshot.
 *
 * The complete diagnostic array always comes back, one entry per input, nothing
 * removed (rule 2). Grouping is an index over it, not a filter of it.
 */
export function detectCausality(
  diagnostics: readonly NormalizedDiagnostic[],
  facts: ProgramFacts,
): DiagnosticReport {
  const ownFiles = new Set(facts.files);

  // site → the members that share it, in input order.
  const buckets = new Map<string, { symbol: SymbolRef; members: NormalizedDiagnostic[] }>();

  for (const diagnostic of diagnostics) {
    const anchor = anchorOf(diagnostic);
    if (!anchor || !isOwnDeclaration(anchor.declaredAt, ownFiles)) continue;

    const site = siteOf(anchor.declaredAt);
    const bucket = buckets.get(site);
    if (bucket) bucket.members.push(diagnostic);
    else buckets.set(site, { symbol: anchor, members: [diagnostic] });
  }

  const groups: DiagnosticGroup[] = [];
  /** diagnostic id → the group it joined, and the group's root if it has one. */
  const membership = new Map<string, { group: string; root: string | undefined }>();

  for (const [site, bucket] of buckets) {
    if (bucket.members.length < MIN_GROUP_SIZE) continue;

    // A member sitting exactly on the cause IS the root: there, the declaration
    // is itself broken. Measured as never occurring on the current corpus, but
    // the shape is cheap to honour and the alternative would be to assert an
    // absence the next fixture could contradict.
    const root = bucket.members.find((member) => siteOf(member.primary) === site);

    const id = groupId(bucket.symbol.kind, site);
    groups.push({
      id,
      cause: { kind: "declaration", symbol: bucket.symbol },
      members: bucket.members.map((member) => member.id),
    });

    for (const member of bucket.members) {
      membership.set(member.id, { group: id, root: root?.id });
    }
  }

  // Second pass — TS2307, keyed on the unresolved specifier. Disjoint from the
  // declaration pass by construction (a 2307 has no `context`, so it never
  // anchored above); `!membership.has` keeps the "≤ 1 group per diagnostic"
  // invariant even if that ever changes. A module has no in-program declaration,
  // so no member sits on the cause — every member is derived, and the header is
  // the specifier, not one of its uses.
  const specBuckets = new Map<string, NormalizedDiagnostic[]>();
  for (const diagnostic of diagnostics) {
    if (diagnostic.code !== 2307 || membership.has(diagnostic.id)) continue;
    const specifier = unresolvedSpecifier(diagnostic, facts.imports);
    if (!specifier) continue;
    const bucket = specBuckets.get(specifier);
    if (bucket) bucket.push(diagnostic);
    else specBuckets.set(specifier, [diagnostic]);
  }

  for (const [specifier, members] of specBuckets) {
    if (members.length < MIN_GROUP_SIZE) continue;

    const id = groupId("module", specifier);
    groups.push({ id, cause: { kind: "module", specifier }, members: members.map((m) => m.id) });
    for (const member of members) {
      membership.set(member.id, { group: id, root: undefined });
    }
  }

  // Ranked by explanatory power: the first thing the agent reads must be the
  // thing that explains the most (§5.1). Ties broken on the cause key so the
  // order is total and a snapshot cannot flap.
  groups.sort(
    (a, b) => b.members.length - a.members.length || causeKey(a).localeCompare(causeKey(b)),
  );

  const enriched = diagnostics.map<EnrichedDiagnostic>((diagnostic) => {
    const joined = membership.get(diagnostic.id);
    const isRoot = !joined || joined.root === diagnostic.id;

    const result: EnrichedDiagnostic = {
      ...diagnostic,
      role: isRoot ? "root" : "derived",
      // Empty unless a real diagnostic explains this one. When the cause is a
      // declaration carrying no diagnostic — the only case the corpus shows —
      // `group` is what carries the link, and inventing an id here would be a
      // link to something that does not exist.
      derivedFrom: !isRoot && joined?.root ? [joined.root] : [],
      facts: [],
      // Enrichment is P2. Nothing here interprets, so nothing here can be unsure:
      // a group is either an identical declaration site or it is not a group.
      confidence: "high",
    };
    if (joined) result.group = joined.group;
    return result;
  });

  return { diagnostics: enriched, groups };
}
