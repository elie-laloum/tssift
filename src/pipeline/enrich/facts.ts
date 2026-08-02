/**
 * Shared fact builders. Every enricher in this directory funnels through here,
 * so the wording of a fact is decided in exactly one place.
 *
 * Two constraints bind every line of text produced below:
 *
 *  - **No imperative, ever** (rule 1). A fact is a statement about what is true:
 *    "interface 'X' declared at …", "members: a, b, c". The moment it says what
 *    to change, tssift is asserting a fix it cannot verify — and
 *    `test/no-prescription.test.ts` fails.
 *  - **Nothing that TypeScript already printed.** A fact that restates the
 *    message costs tokens and adds nothing. What goes here is what the editor
 *    would give for free and the terminal never does: where a type is declared,
 *    what it really contains, which signature was resolved.
 */
import type { Fact, SymbolRef } from "../../types.js";

/**
 * Members listed in full before the count takes over.
 *
 * §5.3 asks for an abbreviated form under budget pressure (`{ id, email, …12
 * more }`); this is that cap, applied unconditionally rather than only under
 * `--budget-tokens`. A 60-member type listed in full is noise at any budget, and
 * a cap that only sometimes applies makes two reports of the same project differ
 * in a way no flag explains.
 */
export const MAX_LISTED_MEMBERS = 12;

/** `id, email, name` — or `id, email, … +48 more` past the cap. */
export function memberList(names: readonly string[]): string {
  if (names.length <= MAX_LISTED_MEMBERS) return names.join(", ");
  const shown = names.slice(0, MAX_LISTED_MEMBERS).join(", ");
  return `${shown}, … +${names.length - MAX_LISTED_MEMBERS} more`;
}

/**
 * The facts a resolved `SymbolRef` yields, in reading order.
 *
 * `declaration` always, because the site is the one thing a terminal reader
 * cannot get: TypeScript names the type and never says where it lives.
 * `members` only when the symbol has any — an alias to a primitive has none, and
 * an empty `members:` line reads as "this type has no members", which is a claim
 * about the type rather than about our resolution.
 */
/**
 * Does this symbol's `signature` say anything its name did not?
 *
 * For a *named* type it does not: `checker.typeToString` renders `interface
 * CreateUserInput { … }` as the four words `CreateUserInput`, because that is
 * how the type is written. Printing it would produce `type 'CreateUserInput'
 * CreateUserInput` — a line that costs tokens and carries nothing. It is the
 * *anonymous* and *callable* types where the rendering is the whole payload: a
 * resolved signature `(action: string, actor: string): AuditEvent` is what
 * TS2554 never tells anyone.
 *
 * This is why the member list, not the shape, is the load-bearing fact on named
 * object types — the opposite of what PROJECT.md §6's mock-up assumed.
 */
export function shapeAddsToName(symbol: SymbolRef): boolean {
  return symbol.signature !== undefined && symbol.signature !== symbol.name;
}

/**
 * `property` for a type, `export` for a module — and **never "member"**.
 *
 * "Member" is ambiguous in exactly the place this list is most useful. For a
 * union, a *member* is a constituent, not a property, so `1 member: type` on
 * `type Shape = Circle | Square` reads as "this union has one arm" when it means
 * "one property is reachable on it". The fixture that exposes this is called
 * `narrowed-union-member`, which is how the collision was found.
 *
 * The list itself is right in both cases: `getPropertiesOfType` returns an
 * interface's own properties, and for a union the ones common to every
 * constituent — i.e. what is actually reachable on the type, which is precisely
 * the question a TS2339 reader is asking.
 */
function membersNoun(symbol: SymbolRef): string {
  return symbol.kind === "module" ? "export" : "property";
}

/**
 * `3 properties`, `1 property`, `3 exports` — counted and pluralised together.
 *
 * The generic `plural()` in the renderer appends an "s" and would write
 * "3 propertys". Rather than teach it English, the two nouns this module can
 * produce are pluralised here, where both are known.
 */
export function membersLabel(symbol: SymbolRef, count: number): string {
  const noun = membersNoun(symbol);
  if (count === 1) return `1 ${noun}`;
  return `${count} ${noun === "property" ? "properties" : `${noun}s`}`;
}

export function factsOfSymbol(symbol: SymbolRef, label: string): Fact[] {
  const shape = shapeAddsToName(symbol) ? ` ${symbol.signature}` : "";
  const facts: Fact[] = [
    {
      kind: "declaration",
      text: `${label}: ${symbol.kind} '${symbol.name}'${shape}`,
      span: symbol.declaredAt,
    },
  ];

  if (symbol.memberNames && symbol.memberNames.length > 0) {
    facts.push({
      kind: "members",
      text: `'${symbol.name}' has ${membersLabel(symbol, symbol.memberNames.length)}: ${memberList(
        symbol.memberNames,
      )}`,
    });
  }

  return facts;
}
