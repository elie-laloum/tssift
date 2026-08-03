import { memberList, membersLabel, shapeAddsToName } from "../pipeline/enrich/facts.js";
import {
  type Entry,
  entriesOf,
  fitToBudget,
  MAX_SHOWN_MEMBERS,
  sizeOf,
} from "../pipeline/index.js";
import type { DiagnosticGroup, EnrichedDiagnostic, Fact, SourceSpan } from "../types.js";
import type { RenderInput } from "./index.js";

/**
 * The default renderer: a lossy projection of `json` (rule 14).
 *
 * Four things not to undo — PROJECT.md §6:
 *  1. the TS message is raw and verbatim, always. H2 arrives through `restated`,
 *     code by code, once the eval justifies it;
 *  2. the output is English, frame included, because the message is English and
 *     rule 3 forbids translating it;
 *  3. one line per diagnostic, never wrapped — a folded message is harder to
 *     grep and its diff is unreadable;
 *  4. **not one imperative anywhere in the frame** (rule 1). "cause:",
 *     "declared at", "more sites" are statements about what is true. The moment
 *     a line here tells the reader what to do, the tool is asserting a fix it
 *     cannot verify.
 *
 * No `id`, no `snippet`, no TypeScript version in the header: the version would
 * make every matrix cell diverge on a field nothing needs.
 */

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/**
 * Collapses any embedded newline so the "one line per diagnostic" rule holds
 * whatever TypeScript hands us. This is a rendering concern only —
 * `NormalizedDiagnostic.message` stays raw in the model (rule 3).
 */
function singleLine(text: string): string {
  return text.replace(/\s*\r?\n\s*/g, " ").trim();
}

function at(span: SourceSpan): string {
  return `${span.file}:${span.line}:${span.column}`;
}

/**
 * A fact, as one line. `at <span>` is a suffix rather than a prefix so the line
 * reads as the statement it is — "type 'X' { … } at file:7:1" — and so the
 * varying part stays at the end where a diff is easy to read.
 */
function factLine(fact: Fact, indent: string): string {
  return `${indent}  ${fact.text}${fact.span ? ` at ${at(fact.span)}` : ""}`;
}

/**
 * The body of a diagnostic: its own line, its chain, its related entries, its
 * facts.
 *
 * `stated` carries the texts the group header has already put on screen. A
 * member's fact matching one of them is dropped here — a rendering decision and
 * nothing more: json still carries every fact on every diagnostic (rule 14), and
 * `--all` renders diagnostics ungrouped, where nothing is suppressed.
 */
function diagnosticLines(
  diagnostic: EnrichedDiagnostic,
  indent: string,
  stated?: (fact: Fact) => boolean,
): string[] {
  const lines: string[] = [
    `${indent}${at(diagnostic.primary)} ${diagnostic.category} TS${diagnostic.code}: ${singleLine(
      diagnostic.message,
    )}`,
  ];

  for (const node of diagnostic.chain) {
    lines.push(
      `${indent}${" ".repeat(2 + 2 * node.depth)}TS${node.code}: ${singleLine(node.text)}`,
    );
  }

  for (const related of diagnostic.related) {
    lines.push(
      related.span
        ? `${indent}  related ${at(related.span)}: ${singleLine(related.message)}`
        : `${indent}  related: ${singleLine(related.message)}`,
    );
  }

  // Fact by fact, against what the header actually printed — not all-or-nothing.
  //
  // It *was* all-or-nothing until 2026-08-02, on the premise that a diagnostic's
  // facts all describe the one symbol its context resolved to, so the presence of
  // the cause's declaration among them meant the whole set was already said.
  // TS2740 broke that premise: `2 more not listed above: …` sits beside the
  // declaration fact and is the one thing on the entry the header cannot state
  // from a `SymbolRef`. Under the old rule it was suppressed in the default
  // rendering and survived only under `--all` — the enrichment invisible exactly
  // where it was worth most.
  for (const fact of diagnostic.facts) {
    if (stated?.(fact)) continue;
    lines.push(factLine(fact, indent));
  }

  return lines;
}

/**
 * A group's header line: what its members share.
 *
 * The header is a **declaration**, not a diagnostic, and that is the whole point
 * of P1's output contract. Measured on the corpus: no group contains a
 * diagnostic sitting on its own cause, so heading the entry with one of the
 * members would put a test file where the explanation belongs.
 */
function causeLine(group: DiagnosticGroup): string {
  const { cause } = group;
  // A module has no declaration to point at: the header names the specifier and
  // stops. A declaration names its kind, name and site.
  if (cause.kind === "module") return `cause: unresolved module '${cause.specifier}'`;
  // Nor has an unresolvable name — saying "declared at" would be false, since the
  // whole failure is that it is declared nowhere. The file is printed because it
  // is half the group key: two files missing the same name are two groups, and
  // without it their headers would be identical strings.
  if (cause.kind === "name") return `cause: unresolved name '${cause.name}' in ${cause.file}`;
  const { symbol } = cause;
  return `cause: ${symbol.kind} '${symbol.name}' declared at ${at(symbol.declaredAt)}`;
}

/**
 * The fact texts a module group may state once, for all of its members.
 *
 * The condition is intersection, not "the first member's facts": a text is
 * hoisted only if **every** member carries it. That is what makes the header
 * line true of the group rather than true of whichever diagnostic happened to
 * sort first — and it holds over all members, not just the ones the display cap
 * leaves visible, so a hidden member never loses a fact it alone had.
 *
 * In practice a 2307 group's facts are identical across members by
 * construction, since they are all statements about the one specifier the group
 * folds on. The intersection is what guarantees that rather than assuming it.
 */
function commonFacts(entry: Extract<Entry, { kind: "group" }>): Fact[] {
  const [first, ...rest] = entry.members;
  if (!first) return [];
  return first.facts.filter((fact) =>
    rest.every((member) => member.facts.some((other) => other.text === fact.text)),
  );
}

/**
 * What the cause *is*, under the line saying where it is — the P2 half of the
 * §6 example.
 *
 * Both lines come straight off the cause's own `SymbolRef`, so a group carries
 * them once for however many members it explains. That is the whole economics of
 * enrichment under folding: 152 diagnostics on one arrow function get one
 * signature line, not 152.
 *
 * The member list is held back only when the shape already spells the type out,
 * which — measured on the fixtures — is rarer than §6's mock-up assumed: a named
 * interface renders as its own name, so on the contract fixture the shape line
 * is dropped and the member list is the fact. See `shapeAddsToName`.
 */
function causeFactLines(entry: Extract<Entry, { kind: "group" }>): string[] {
  const { group } = entry;

  // The `module` and `name` arms carry no `SymbolRef` — there is nothing declared
  // to describe — so their facts come off the members, which by construction all
  // name the same unresolved specifier (or identifier) and therefore produce the
  // same facts. Hoisting them here is what keeps the economics of §5.2 intact:
  // three importers of `qs` get one statement about `qs`, not three.
  //
  // `name` has no enricher today, so the intersection is empty and this returns
  // nothing — which is the correct amount to say about a name that is declared
  // nowhere. Note that folding cannot degrade a TS2552's `Did you mean`: every
  // member of a group shares the missing name, hence the same suggestion, so a
  // site hidden by the display cap takes no unique information with it.
  if (group.cause.kind === "module" || group.cause.kind === "name") {
    return commonFacts(entry).map((fact) => `      ${fact.text}`);
  }

  const { symbol } = group.cause;
  const lines: string[] = [];

  const shape = shapeAddsToName(symbol);
  if (shape) lines.push(`      ${symbol.signature}`);

  const members = symbol.memberNames ?? [];
  // A truncated signature has stopped answering "what does it contain", so the
  // list earns its line even next to a shape.
  if (members.length > 0 && (!shape || symbol.signature?.endsWith("…"))) {
    lines.push(`      ${membersLabel(symbol, members.length)}: ${memberList(members)}`);
  }

  return lines;
}

/** `152 diagnostics, all TS2554` when they agree, the spread when they do not. */
function membersLine(members: readonly EnrichedDiagnostic[]): string {
  const codes = [...new Set(members.map((member) => member.code))].sort((a, b) => a - b);
  const summary =
    codes.length === 1 ? `all TS${codes[0]}` : codes.map((code) => `TS${code}`).join(" · ");
  return `${plural(members.length, "diagnostic")}, ${summary}`;
}

function groupLines(
  entry: Extract<Entry, { kind: "group" }>,
  index: number,
  maxMembers = MAX_SHOWN_MEMBERS,
): string[] {
  const { cause } = entry.group;
  const causeAt = cause.kind === "declaration" ? at(cause.symbol.declaredAt) : undefined;
  const fromSymbol = causeFactLines(entry).map((line) => line.trim());

  /**
   * Has the header already said this?
   *
   * Three ways it can have, and the third is the one worth spelling out:
   *  - the fact points at the cause's own site, which the `cause:` line names;
   *  - its text is verbatim a header line (the module arm, where the header IS
   *    the common facts);
   *  - its text *ends* with a header line. `'CreateUserInput' has 3 properties:
   *    id, email, name` and the header's `3 properties: id, email, name` are the
   *    same list written twice, and only the suffix relation catches that
   *    without hard-coding either wording.
   */
  const stated = (fact: Fact): boolean =>
    (causeAt !== undefined && fact.span !== undefined && at(fact.span) === causeAt) ||
    fromSymbol.some((line) => fact.text === line || fact.text.endsWith(line));

  // Whatever every member carries and the header has NOT said: stated once, here,
  // instead of once per member. On a declaration group this is normally empty —
  // the facts describe the cause and the header describes the cause. TS2740 is
  // the case where it is not: the members TypeScript counted and declined to name
  // are a property of the failure, not of the target type, so no `SymbolRef` can
  // produce them.
  const extra = commonFacts(entry).filter((fact) => !stated(fact));

  const lines = [
    `[${index}] ${causeLine(entry.group)}`,
    ...causeFactLines(entry),
    ...extra.map((fact) => `      ${fact.text}`),
    `    ${membersLine(entry.members)}`,
  ];

  const hoisted = new Set(extra.map((fact) => fact.text));
  const said = (fact: Fact): boolean => stated(fact) || hoisted.has(fact.text);

  // The cap declasses the tail: those members lose their line and survive as a
  // count. Nothing is removed from the table — `--all` still prints every one,
  // and json still carries them all (rule 2).
  const shown = entry.members.slice(0, maxMembers);
  for (const member of shown) lines.push(...diagnosticLines(member, "    ", said));

  const hidden = entry.members.length - shown.length;
  if (hidden > 0) lines.push(`    +${plural(hidden, "more site")} (--all for every one)`);

  return lines;
}

/** A lone diagnostic's block, numbered. */
function loneLines(diagnostic: EnrichedDiagnostic, index: number): string[] {
  const [head, ...rest] = diagnosticLines(diagnostic, "");
  return [`[${index}] ${head}`, ...rest.map((line) => `  ${line}`)];
}

/**
 * One entry, rendered from most to least detailed, for the budget to choose from.
 *
 * A **lone diagnostic offers exactly one form**: it is a root, and rule 6 forbids
 * truncating a root. It is rendered whole or dropped whole — never half.
 *
 * A **group** may shed member lines, because its members are derived and its
 * cause header is what carries the explanation. The last form keeps the header
 * and the counts and nothing else, which is still the useful part.
 */
function variantsOf(entry: Entry, index: number): string[][] {
  if (entry.kind === "diagnostic") return [["", ...loneLines(entry.diagnostic, index)]];
  return [MAX_SHOWN_MEMBERS, 1, 0].map((max) => ["", ...groupLines(entry, index, max)]);
}

export function renderAgentText(input: RenderInput): string {
  const { diagnostics } = input.report;
  const lines: string[] = [`root: ${input.rootLabel}`];

  if (diagnostics.length === 0) {
    // A clean run prints a line rather than nothing, so success cannot be
    // mistaken for a swallowed crash (PROJECT.md §9). The file count travels
    // with the zero so the zero is verifiable: `0 errors · 0 files checked`
    // reads as "nothing was checked", which a bare `0 errors` hides.
    lines.push(`0 errors · ${plural(input.facts.files.length, "file")} checked`);
    return `${lines.join("\n")}\n`;
  }

  const errors = diagnostics.filter((d) => d.category === "error").length;
  const warnings = diagnostics.filter((d) => d.category === "warning").length;
  const files = new Set(diagnostics.map((d) => d.primary.file)).size;

  const entries = entriesOf(input.report, input.all);
  const groups = entries.filter((entry) => entry.kind === "group").length;

  const summary = [plural(errors, "error"), plural(files, "file")];
  if (warnings > 0) summary.push(plural(warnings, "warning"));
  // Only when there is something to say: a report with no group should not
  // announce "0 root causes", which reads as a failure to find any.
  if (groups > 0) summary.push(plural(groups, "root cause"));
  lines.push(summary.join(" · "));

  // `--all` restores every diagnostic in full and therefore ignores the budget:
  // the two flags express opposite intents and rule 2 gives `--all` the last
  // word. This is stated in the usage text rather than left to be discovered.
  const budget = input.all ? undefined : input.budgetTokens;

  const fitted = fitToBudget(
    lines,
    entries.map((entry, index) => ({
      variants: variantsOf(entry, index + 1),
      diagnostics: sizeOf(entry),
    })),
    budget,
  );

  return `${fitted.lines.join("\n")}\n`;
}
