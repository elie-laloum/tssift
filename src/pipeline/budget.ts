/**
 * Token budget — truncation under constraint (PROJECT.md §5.3).
 *
 * Ships together with the `--budget-tokens` flag that exposes it, never before:
 * a flag that parses and does nothing is a lie with a version number
 * (decision 27 of the P1 plan).
 *
 * ## What "tokens" means here, exactly
 *
 * An **estimate**, `characters / 4`, with the divisor stated wherever the number
 * appears — the same convention `EVAL.md` publishes. Counting real tokens would
 * mean shipping a tokenizer, pinning it to one vendor's vocabulary, and being
 * wrong for every other model. The character is the primitive anyone can
 * reproduce; the budget is honoured against it and says so.
 *
 * ## The order of sacrifice (§5.3)
 *
 * 1. Long types → abbreviated. **A no-op in P1, and deliberately so.** The only
 *    long types on screen live inside TypeScript's own message, which rule 3
 *    forbids touching. The abbreviated forms §5.3 describes belong to the facts
 *    P2 renders, so this step arrives with them.
 * 2. Derived usage sites → a counter. This is where P1's budget actually bites:
 *    a group sheds member lines, three then one then none, keeping its cause
 *    header and its count.
 * 3. Low-ranked entries → `+N more errors`.
 *
 * ## Rule 6, and the one case where the budget is deliberately exceeded
 *
 * **A root is never truncated.** Entries arrive ranked by explanatory power, so
 * an entry is either rendered in one of its allowed forms or dropped whole into
 * the trailing counter — never rendered half-way.
 *
 * The consequence is that the *first* entry is never sacrificed. If the budget
 * cannot fit even it, the budget is exceeded and the result says `exceeded`.
 * That is the honest reading of rule 6: the most explanatory item is the one
 * thing the agent must read, so a budget too small to hold it is a budget that
 * was wrong, not a reason to return a report with nothing in it.
 */

/** The announced divisor. Stated everywhere the estimate surfaces. */
export const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export interface BudgetedEntry {
  /**
   * Renderings of this entry from most to least detailed. The last one is the
   * irreducible minimum — below it the entry is dropped, not shrunk further.
   */
  variants: string[][];
  /** Diagnostics this entry accounts for, for the trailing counter. */
  diagnostics: number;
}

export interface BudgetResult {
  lines: string[];
  droppedEntries: number;
  droppedDiagnostics: number;
  /** True when rule 6 forced the budget to be overrun. */
  exceeded: boolean;
}

function cost(lines: readonly string[]): number {
  // +1 per line for the newline that will join them — small, but the point of a
  // budget is that it is not optimistic.
  return estimateTokens(lines.join("\n")) + 1;
}

/**
 * Fit ranked entries into a token budget.
 *
 * `budgetTokens` undefined ⇒ no constraint, every entry at full detail.
 */
export function fitToBudget(
  header: readonly string[],
  entries: readonly BudgetedEntry[],
  budgetTokens: number | undefined,
): BudgetResult {
  const full = (entry: BudgetedEntry): string[] => entry.variants[0] ?? [];

  if (budgetTokens === undefined) {
    return {
      lines: [...header, ...entries.flatMap(full)],
      droppedEntries: 0,
      droppedDiagnostics: 0,
      exceeded: false,
    };
  }

  const lines = [...header];
  let spent = cost(header);
  let exceeded = false;
  let dropped = 0;
  let droppedDiagnostics = 0;

  for (const [index, entry] of entries.entries()) {
    // Room held back for the trailing counter, so the report can always say how
    // much it withheld. Withholding silently would be the one thing worse than
    // withholding.
    const reserve = index < entries.length - 1 ? 16 : 0;
    const room = budgetTokens - spent - reserve;

    const chosen = entry.variants.find((variant) => cost(variant) <= room);

    if (chosen) {
      lines.push(...chosen);
      spent += cost(chosen);
      continue;
    }

    if (index === 0) {
      // Rule 6. The most explanatory entry is not negotiable against a number.
      const first = full(entry);
      lines.push(...first);
      spent += cost(first);
      exceeded = true;
      continue;
    }

    // Entries are ranked, so everything after this one explains less. Skipping
    // ahead to squeeze in a smaller, less explanatory entry would invert the
    // ranking the whole report exists to express.
    for (const remaining of entries.slice(index)) {
      dropped += 1;
      droppedDiagnostics += remaining.diagnostics;
    }
    break;
  }

  if (dropped > 0) {
    lines.push(
      "",
      `+${droppedDiagnostics} more error${droppedDiagnostics === 1 ? "" : "s"} in ${dropped} ` +
        `entr${dropped === 1 ? "y" : "ies"} withheld by --budget-tokens (--all for every one)`,
    );
  }

  return { lines, droppedEntries: dropped, droppedDiagnostics, exceeded };
}
