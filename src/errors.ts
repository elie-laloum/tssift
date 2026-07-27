/**
 * "tssift could not run" — exit code 2.
 *
 * Distinct from "your code has type errors" (exit 1) and from a clean run
 * (exit 0). The agent tells the two apart without parsing text; that is the
 * product's own thesis applied to its own failure modes (PROJECT.md §9).
 *
 * Rule 15: no silent fallback. Every throw site names what was looked for and
 * where. Never a stderr warning, never a "let's carry on anyway".
 */
export class TssiftUnrunnable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TssiftUnrunnable";
  }
}
