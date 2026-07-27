import { type Entry, entriesOf, MAX_SHOWN_MEMBERS } from "../pipeline/index.js";
import type { DiagnosticGroup, EnrichedDiagnostic, SourceSpan } from "../types.js";
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

/** The body of a diagnostic: its own line, its chain, its related entries. */
function diagnosticLines(diagnostic: EnrichedDiagnostic, indent: string): string[] {
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
  const { symbol } = group.cause;
  return `cause: ${symbol.kind} '${symbol.name}' declared at ${at(symbol.declaredAt)}`;
}

/** `152 diagnostics, all TS2554` when they agree, the spread when they do not. */
function membersLine(members: readonly EnrichedDiagnostic[]): string {
  const codes = [...new Set(members.map((member) => member.code))].sort((a, b) => a - b);
  const summary =
    codes.length === 1 ? `all TS${codes[0]}` : codes.map((code) => `TS${code}`).join(" · ");
  return `${plural(members.length, "diagnostic")}, ${summary}`;
}

function groupLines(entry: Extract<Entry, { kind: "group" }>, index: number): string[] {
  const lines = [`[${index}] ${causeLine(entry.group)}`, `    ${membersLine(entry.members)}`];

  // The cap declasses the tail: those members lose their line and survive as a
  // count. Nothing is removed from the table — `--all` still prints every one,
  // and json still carries them all (rule 2).
  const shown = entry.members.slice(0, MAX_SHOWN_MEMBERS);
  for (const member of shown) lines.push(...diagnosticLines(member, "    "));

  const hidden = entry.members.length - shown.length;
  if (hidden > 0) lines.push(`    +${plural(hidden, "more site")} (--all for every one)`);

  return lines;
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

  entries.forEach((entry, index) => {
    lines.push("");
    if (entry.kind === "group") {
      lines.push(...groupLines(entry, index + 1));
    } else {
      const [head, ...rest] = diagnosticLines(entry.diagnostic, "");
      lines.push(`[${index + 1}] ${head}`, ...rest.map((line) => `  ${line}`));
    }
  });

  return `${lines.join("\n")}\n`;
}
