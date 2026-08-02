/**
 * `pipeline/budget.ts` and the `--budget-tokens` flag that exposes it.
 *
 * They ship together (decision 27 of the P1 plan): a flag that parses and does
 * nothing is a lie with a version number. So these tests exercise both ends —
 * the pure fitting function, and the CLI path that reaches it.
 */
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONTEXT_CAPTURE_CODES } from "../src/codes.js";
import { TssiftUnrunnable } from "../src/errors.js";
import {
  type BudgetedEntry,
  CHARS_PER_TOKEN,
  dedupe,
  detectCausality,
  estimateTokens,
  fitToBudget,
} from "../src/pipeline/index.js";
import { renderAgentText } from "../src/render/agent-text.js";
import { parseArgs } from "../src/run.js";
import { TsApiSource } from "../src/sources/ts-api.js";

function build(name: string, extra: { all?: boolean; budgetTokens?: number } = {}) {
  const project = fileURLToPath(new URL(`../fixtures/${name}/before`, import.meta.url));
  const { diagnostics, facts } = new TsApiSource().load({
    project,
    captureFor: CONTEXT_CAPTURE_CODES,
  });
  return {
    report: detectCausality(dedupe(diagnostics, facts), facts),
    facts,
    rootLabel: name,
    all: false,
    ...extra,
  };
}

function entry(lines: string[][], diagnostics = 1): BudgetedEntry {
  return { variants: lines, diagnostics };
}

const line = (chars: number) => "x".repeat(chars);

describe("budget · the fitting function", () => {
  it("is unconstrained when no budget is given", () => {
    const result = fitToBudget(["head"], [entry([[line(4000)]])], undefined);
    expect(result.droppedEntries).toBe(0);
    expect(result.exceeded).toBe(false);
    expect(result.lines).toHaveLength(2);
  });

  it("picks the most detailed variant that fits", () => {
    const result = fitToBudget(
      [],
      [entry([[line(4000)], [line(400)], [line(40)]])],
      // 4000 chars is 1000 tokens, 400 is 100, 40 is 10. 150 admits the middle.
      150,
    );
    expect(result.lines[0]).toHaveLength(400);
    expect(result.exceeded).toBe(false);
  });

  it("drops low-ranked entries into a counter rather than shrinking them silently", () => {
    const result = fitToBudget(
      [],
      [entry([[line(40)]]), entry([[line(4000)]], 7), entry([[line(40)]], 3)],
      40,
    );
    expect(result.droppedEntries).toBe(2);
    expect(result.droppedDiagnostics).toBe(10);
    expect(result.lines.join("\n")).toContain("+10 more errors");
    expect(result.lines.join("\n")).toContain("--all");
  });

  it("drops the whole tail once one entry does not fit, never reordering", () => {
    // Entries arrive ranked by explanatory power. Skipping a large entry to
    // squeeze in a smaller one behind it would invert the ranking the report
    // exists to express, and quietly promote the least explanatory item.
    const result = fitToBudget(
      [],
      [entry([[line(40)]]), entry([[line(4000)]]), entry([[line(4)]])],
      40,
    );
    expect(result.droppedEntries).toBe(2);
    expect(result.lines.filter((l) => l.startsWith("x"))).toHaveLength(1);
  });

  it("exceeds the budget rather than sacrifice the first entry (rule 6)", () => {
    // A root is never truncated. A budget too small to hold the most
    // explanatory item is a budget that was wrong — returning a report with
    // nothing in it would be worse than overrunning by a stated amount.
    const result = fitToBudget([], [entry([[line(4000)], [line(2000)]])], 1);
    expect(result.exceeded).toBe(true);
    expect(result.lines[0]).toHaveLength(4000);
    expect(result.droppedEntries).toBe(0);
  });

  it("never reports a drop without saying how much it withheld", () => {
    const result = fitToBudget([], [entry([[line(4)]]), entry([[line(4000)]], 5)], 10);
    expect(result.droppedEntries).toBeGreaterThan(0);
    expect(result.lines.some((l) => l.includes("withheld by --budget-tokens"))).toBe(true);
  });

  it("estimates tokens with the announced divisor", () => {
    expect(CHARS_PER_TOKEN).toBe(4);
    expect(estimateTokens("x".repeat(400))).toBe(100);
  });
});

/**
 * A budget that the smallest rendering of this fixture still fits inside.
 *
 * It was 60 until P2. Enrichment added a property list to the cause header,
 * which raised the *floor* — the irreducible form of a group, header and counts
 * with no member lines — from roughly 55 to roughly 68 tokens. Below the floor
 * rule 6 takes over and renders the entry whole, so a budget of 60 now produces
 * the full report and the assertion below would be testing nothing.
 *
 * The number is therefore not arbitrary and not free to drift downward: it says
 * "above this fixture's floor". If it has to move again, the floor moved, and
 * that is a fact worth knowing rather than a test to relax.
 */
const ABOVE_FLOOR = 80;

describe("budget · through the renderer", () => {
  it("actually shrinks the report", () => {
    const unbudgeted = renderAgentText(build("partial-interface-rename"));
    const budgeted = renderAgentText(
      build("partial-interface-rename", { budgetTokens: ABOVE_FLOOR }),
    );
    expect(budgeted.length).toBeLessThan(unbudgeted.length);
  });

  it("below the floor, rule 6 renders the entry whole rather than half", () => {
    // Not a regression: an entry is rendered in one of its allowed forms or
    // dropped, never cut. The first entry is never dropped, so a budget too
    // small to hold even its shortest form is a budget that was wrong.
    const unbudgeted = renderAgentText(build("partial-interface-rename"));
    const starved = renderAgentText(build("partial-interface-rename", { budgetTokens: 20 }));
    expect(starved).toBe(unbudgeted);
  });

  it("keeps the cause header when it sheds usage sites", () => {
    // §5.3's order of sacrifice: derived sites go before anything explanatory.
    const budgeted = renderAgentText(
      build("partial-interface-rename", { budgetTokens: ABOVE_FLOOR }),
    );
    expect(budgeted).toContain("cause: interface 'CreateUserInput'");
    expect(budgeted).toContain("src/types/user.ts:7:1");
    // And the fact the header carries is explanatory too, so it survives with it.
    expect(budgeted).toContain("3 properties: id, email, name");
  });

  it("--all ignores the budget (rule 2 wins)", () => {
    const withAll = renderAgentText(
      build("partial-interface-rename", { all: true, budgetTokens: 1 }),
    );
    const plainAll = renderAgentText(build("partial-interface-rename", { all: true }));
    expect(withAll).toBe(plainAll);
    expect((withAll.match(/^\[\d+\] /gm) ?? []).length).toBe(3);
  });

  it("never truncates a lone root — it renders whole or not at all", () => {
    // overload-mismatch is a single diagnostic with a branching chain and three
    // related entries: over 1100 characters that cannot legally be cut.
    const tiny = renderAgentText(build("overload-mismatch", { budgetTokens: 1 }));
    expect(tiny).toContain("No overload matches this call.");
    expect(tiny).toContain("Overload 3 of 3");
    expect(tiny).toContain("related src/transport/request.ts:22:3");
  });

  it("respects a budget it can meet", () => {
    const budget = 120;
    const text = renderAgentText(build("partial-interface-rename", { budgetTokens: budget }));
    expect(estimateTokens(text)).toBeLessThanOrEqual(budget);
  });
});

describe("--budget-tokens · the flag", () => {
  it("parses a positive whole number", () => {
    expect(parseArgs(["--budget-tokens", "500"]).budgetTokens).toBe(500);
  });

  it("is absent by default", () => {
    expect(parseArgs([]).budgetTokens).toBeUndefined();
  });

  for (const bad of ["0", "-1", "1e3", "12.5", "0x40", "abc", " 12 ", ""]) {
    it(`refuses ${JSON.stringify(bad)} rather than reading it as no budget`, () => {
      // A budget silently read as NaN would disable the very constraint the
      // caller asked for — the silent fallback rule 15 forbids.
      expect(() => parseArgs(["--budget-tokens", bad])).toThrowError(TssiftUnrunnable);
    });
  }

  it("refuses a missing value", () => {
    expect(() => parseArgs(["--budget-tokens"])).toThrowError(TssiftUnrunnable);
  });

  it("is documented in the usage text, together with what it does not do", async () => {
    const { USAGE } = await import("../src/run.js");
    expect(USAGE).toContain("--budget-tokens");
    expect(USAGE).toContain("characters / 4");
    // The interaction with --all is stated rather than left to be discovered.
    expect(USAGE).toContain("Ignores");
  });
});
