/**
 * TS2739 — `Type 'S' is missing the following properties from type 'T': a, b`.
 * TS2741 — the same failure at exactly one missing property: `Property 'a' is
 * missing in type 'S' but required in type 'T'`.
 *
 * One enricher, for the reason `src/codes.ts` records: which of the two codes
 * fires depends on *how many* members were forgotten, not on what went wrong.
 *
 * What is added is the **declaration site of `T`**, and that is all. It is the
 * one thing a terminal reader cannot obtain: TypeScript names the target type
 * in every one of these messages and never once says where it lives, so the
 * reader of a three-file cascade knows `Profile` is at fault and has to grep
 * for it.
 *
 * ## What is not added, and this one is a correction
 *
 * §5.2 asks these two codes for "the exact list of the missing, without the
 * rest of the type", on the stated ground that TypeScript truncates its own.
 * **It does not** — measured on 5.9.3 over 1 to 8 missing properties:
 *
 *  - 1 missing ⇒ **TS2741**, which names it;
 *  - 2 to 5 ⇒ **TS2739**, complete list, never elided;
 *  - 6 or more ⇒ **TS2740**, `…, and N more.`, truncated at four.
 *
 * The truncation §5.2 describes belongs to **TS2740**, a code that is not in
 * its table of ten. So for 2739 and 2741 the list is already printed in full,
 * and repeating it would be the one thing `facts.ts` forbids: a fact that
 * restates the message.
 *
 * This enricher therefore emits **one** fact and stops, where the other six run
 * `factsOfSymbol` and emit a member list too. The list is redundant *here*
 * specifically: TypeScript prints the missing members and the supplied type's
 * own shape (`{ x: number; y: number; }`), so `x, y, width, height` is the union
 * of two lists already on screen.
 *
 * It still appears **once**, on the group header, and that is not an oversight.
 * A group's header describes its cause off the `SymbolRef` itself
 * (`causeFactLines`), uniformly for every code that folds on a declaration —
 * so the choice is not "print the list or not" but "print it once for the
 * cascade or once per member". Once per member is what this file declines.
 */
import type { Fact, NormalizedDiagnostic } from "../../types.js";

export function enrich2739(diagnostic: NormalizedDiagnostic): Fact[] {
  const expected = diagnostic.context?.expected;
  if (!expected) return [];

  return [
    {
      kind: "declaration",
      text: `required by: ${expected.kind} '${expected.name}'`,
      span: expected.declaredAt,
    },
  ];
}
