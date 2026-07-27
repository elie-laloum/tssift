import type { NormalizedDiagnostic, SourceSpan } from "../types.js";
import type { RenderInput } from "./index.js";

/**
 * The default renderer: a lossy projection of `json` (rule 14).
 *
 * Three things not to undo — PROJECT.md §6:
 *  1. the TS message is raw and verbatim, always. H2 arrives through `restated`,
 *     code by code, once the eval justifies it;
 *  2. the output is English, frame included, because the message is English and
 *     rule 3 forbids translating it;
 *  3. one line per diagnostic, never wrapped — a folded message is harder to
 *     grep and its diff is unreadable.
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

function renderDiagnostic(diagnostic: NormalizedDiagnostic, index: number): string[] {
  const lines: string[] = [
    `[${index}] ${at(diagnostic.primary)} ${diagnostic.category} TS${diagnostic.code}: ${singleLine(
      diagnostic.message,
    )}`,
  ];

  for (const node of diagnostic.chain) {
    lines.push(`${" ".repeat(4 + 2 * node.depth)}TS${node.code}: ${singleLine(node.text)}`);
  }

  for (const related of diagnostic.related) {
    lines.push(
      related.span
        ? `    related ${at(related.span)}: ${singleLine(related.message)}`
        : `    related: ${singleLine(related.message)}`,
    );
  }

  return lines;
}

export function renderAgentText(input: RenderInput): string {
  const { diagnostics } = input;
  const lines: string[] = [`root: ${input.rootLabel}`];

  if (diagnostics.length === 0) {
    // A clean run prints a line rather than nothing, so success cannot be
    // mistaken for a swallowed crash (PROJECT.md §9).
    lines.push("0 errors");
    return `${lines.join("\n")}\n`;
  }

  const errors = diagnostics.filter((d) => d.category === "error").length;
  const warnings = diagnostics.filter((d) => d.category === "warning").length;
  const files = new Set(diagnostics.map((d) => d.primary.file)).size;

  const summary = [plural(errors, "error"), plural(files, "file")];
  if (warnings > 0) summary.push(plural(warnings, "warning"));
  lines.push(summary.join(" · "));

  diagnostics.forEach((diagnostic, index) => {
    lines.push("");
    lines.push(...renderDiagnostic(diagnostic, index + 1));
  });

  return `${lines.join("\n")}\n`;
}
