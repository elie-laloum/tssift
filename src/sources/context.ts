/**
 * Selective `DiagnosticContext` resolution — the only place, with `ts-api.ts`,
 * that is allowed to touch a `TypeChecker` (rule 4).
 *
 * Why this exists at all: the pipeline never sees the checker, so everything it
 * could ever need has to be captured here, at ingestion. Causality in particular
 * needs a *declaration site* it can compare for identity — §5.1 lets a
 * diagnostic be derived only on a structural link present in the captured data,
 * and a `declaredAt` is that link.
 *
 * Why it is selective: each resolution costs a checker round-trip. The list of
 * codes lives in `src/codes.ts` and is justified entry by entry there.
 *
 * The contract of every resolver below: **return `undefined` rather than guess**
 * (rule 5). A missing context degrades to the native format, which is a success.
 * A wrong `declaredAt` would let causality hide a real error behind a counter,
 * which is the failure PROJECT.md §11 classes as critical.
 */
import type * as TS from "typescript";
import type { DiagnosticContext, SourceSpan, SymbolRef } from "../types.js";

/** `SymbolRef.signature` is a rendering of a type, and §4 says it is truncated. */
const SIGNATURE_MAX = 200;

function truncate(text: string): string {
  return text.length <= SIGNATURE_MAX ? text : `${text.slice(0, SIGNATURE_MAX - 1)}…`;
}

/**
 * The deepest node whose span contains `position`.
 *
 * `forEachChild` rather than `getChildren`: it visits the real nodes without
 * materialising the punctuation tokens, and every node a resolver below cares
 * about (identifiers, expressions, specifiers) is a real node. `getStart(file)`
 * skips leading trivia, so a diagnostic that starts on a token start matches the
 * token and not the comment above it.
 */
export function nodeAt(ts: typeof TS, file: TS.SourceFile, position: number): TS.Node | undefined {
  let deepest: TS.Node | undefined;
  const visit = (node: TS.Node): void => {
    if (node.getStart(file) > position || position >= node.getEnd()) return;
    deepest = node;
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(file, visit);
  return deepest;
}

/**
 * A declaration's kind, as a stable string.
 *
 * Deliberately not `ts.SyntaxKind[kind]`: that leaks compiler internals into the
 * published model and its spelling is free to move between TypeScript versions.
 * Anything unmapped degrades to "declaration" rather than inventing a label.
 */
function declarationKind(ts: typeof TS, declaration: TS.Declaration): string {
  const { SyntaxKind } = ts;
  switch (declaration.kind) {
    case SyntaxKind.InterfaceDeclaration:
      return "interface";
    case SyntaxKind.TypeAliasDeclaration:
      return "type-alias";
    case SyntaxKind.TypeLiteral:
      return "type-literal";
    case SyntaxKind.ClassDeclaration:
    case SyntaxKind.ClassExpression:
      return "class";
    case SyntaxKind.FunctionDeclaration:
    case SyntaxKind.FunctionExpression:
    case SyntaxKind.ArrowFunction:
      return "function";
    case SyntaxKind.MethodDeclaration:
    case SyntaxKind.MethodSignature:
      return "method";
    case SyntaxKind.PropertyDeclaration:
    case SyntaxKind.PropertySignature:
      return "property";
    case SyntaxKind.VariableDeclaration:
      return "variable";
    case SyntaxKind.Parameter:
      return "parameter";
    case SyntaxKind.EnumDeclaration:
      return "enum";
    case SyntaxKind.EnumMember:
      return "enum-member";
    case SyntaxKind.SourceFile:
    case SyntaxKind.ModuleDeclaration:
      return "module";
    default:
      return "declaration";
  }
}

/**
 * A name a reader can look up.
 *
 * TypeScript names anonymous object types `__type`, `__object`, and so on. That
 * is an implementation detail, not something anyone can search for. When the
 * symbol has no usable name, the nearest enclosing *named* declaration is used
 * instead — for the union member `{ readonly ok: true; readonly data: T }` inside
 * `type Result<T, E> = …`, that is `Result`.
 *
 * `declaredAt` keeps pointing at the anonymous node itself, so the pair stays
 * verifiable: "the type literal at result.ts:12:4, which lives in Result".
 */
function displayName(ts: typeof TS, symbol: TS.Symbol, declaration: TS.Declaration): string {
  const own = symbol.getName();
  if (own && !own.startsWith("__")) return own;

  for (let node: TS.Node | undefined = declaration; node; node = node.parent) {
    const named = (node as { name?: TS.Node }).name;
    if (named && ts.isIdentifier(named)) return named.text;
    if (ts.isSourceFile(node)) break;
  }
  return own || "(anonymous)";
}

/** Where a declaration begins. Identity of this span is what causality compares. */
type SpanOf = (file: TS.SourceFile, start: number, length: number) => SourceSpan;

function declarationSpan(ts: typeof TS, declaration: TS.Declaration, spanOf: SpanOf): SourceSpan {
  const file = declaration.getSourceFile();
  // A whole module is declared at 1:1, not at its first token: `getStart` skips
  // leading trivia and would land past the license header, which reads as a
  // position with a meaning it does not have.
  const start = ts.isSourceFile(declaration) ? 0 : declaration.getStart(file);
  // Length zero on purpose: a `declaredAt` is a *point*. That is all the identity
  // comparison needs, and spanning a 40-line interface would put 40 lines of
  // `endLine`/`endColumn` noise in json for no reader's benefit. The `snippet`
  // still carries the declaration's opening line.
  return spanOf(file, start, 0);
}

/**
 * Does this type have members of its own, or only a primitive's prototype?
 *
 * `getPropertiesOfType` answers on the *apparent* type, so a union of string
 * literals comes back with the fifty members of `String` — `charAt`, `blink`,
 * `fontcolor`. Printing those as "what 'Currency' contains" would be noise at
 * best and a claim about the wrong type at worst.
 *
 * This is the mirror of the P2 finding recorded in `facts.ts`. There, for a
 * *named object* type, the property list carries the information and the shape
 * is just the name. Here, for a union of primitives, it is the exact opposite:
 * the property list is prototype noise and the shape is the payload. Neither
 * one generalises, which is why both are decided by a test on the type.
 *
 * Measured 2026-08-02: no fixture triggered this before TS2322 was captured, so
 * the guard changes no existing output — it stops the first case that would
 * have hit it.
 */
function hasOwnMembers(ts: typeof TS, type: TS.Type): boolean {
  const constituents = type.isUnion() ? type.types : [type];
  return constituents.every((member) => (member.flags & ts.TypeFlags.Object) !== 0);
}

/**
 * A type, as a `SymbolRef` anchored on its declaration.
 *
 * Returns `undefined` when the type has no declaration to point at — `{}`,
 * `unknown`, an error type. Measured on the corpus (2026-07-27): 8 of 99 TS2339
 * land there, every one of them downstream of an implicit `any` parameter. There
 * is genuinely no declaration site, so no context is the honest answer.
 */
function symbolRefOfType(
  ts: typeof TS,
  checker: TS.TypeChecker,
  type: TS.Type,
  spanOf: SpanOf,
): SymbolRef | undefined {
  // `getSymbol()` first: it names the precise type, where `aliasSymbol` names the
  // alias it was reached through. The precise one is the one whose declaration
  // two diagnostics must share to be the same cause.
  const symbol = type.getSymbol() ?? type.aliasSymbol;
  const declaration = symbol?.declarations?.[0];
  if (!symbol || !declaration) return undefined;

  const name = displayName(ts, symbol, declaration);

  const own = hasOwnMembers(ts, type);

  // When `typeToString` gives back the name we are about to print anyway, it has
  // said nothing — that is the whole point of `shapeAddsToName`. For a union of
  // *primitives* we can do better than give up: its constituents are its whole
  // definition, and for `type Currency = "EUR" | "USD"` they are precisely what
  // TS2322's message never states.
  //
  // Gated on `own` because the two halves of that sentence are the same axis,
  // measured on two fixtures the same day. Expanding a union of *objects*
  // instead makes things worse: `narrowed-union-member` renders 130 characters
  // of three object literals in place of `1 property: type`, which is the fact
  // that actually answers "why does `.kind` not exist on Shape". Where the
  // property list carries the information, the shape must stay out of its way.
  let signature = truncate(checker.typeToString(type));
  if (!own && signature === name && type.isUnion()) {
    signature = truncate(type.types.map((member) => checker.typeToString(member)).join(" | "));
  }

  const ref: SymbolRef = {
    name,
    kind: declarationKind(ts, declaration),
    declaredAt: declarationSpan(ts, declaration, spanOf),
    signature,
  };

  const members = own
    ? checker
        .getPropertiesOfType(type)
        .map((property) => property.getName())
        // `__@iterator@2156`, `__@toStringTag@2198`: well-known symbols, spelled
        // with an internal id that changes between compilations. They are not
        // names anyone can look up, and the id would make a snapshot differ from
        // one run to the next — the same reason `displayName` refuses `__type`.
        .filter((name) => !name.startsWith("__@"))
    : [];
  if (members.length > 0) ref.memberNames = members;
  return ref;
}

/** The `moduleSpecifier` an import or export specifier ultimately belongs to. */
function moduleSpecifierOf(ts: typeof TS, from: TS.Node): TS.StringLiteral | undefined {
  for (let node: TS.Node | undefined = from; node; node = node.parent) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const specifier = node.moduleSpecifier;
      return specifier && ts.isStringLiteral(specifier) ? specifier : undefined;
    }
    if (ts.isSourceFile(node)) return undefined;
  }
  return undefined;
}

/** The nearest enclosing call, starting at `node` itself. */
function enclosingCall(ts: typeof TS, node: TS.Node): TS.CallLikeExpression | undefined {
  for (let current: TS.Node | undefined = node; current; current = current.parent) {
    if (ts.isCallExpression(current) || ts.isNewExpression(current)) return current;
    if (ts.isSourceFile(current)) return undefined;
  }
  return undefined;
}

/** How a callee is written, in the shortest form that stays checkable against the source. */
function calleeName(ts: typeof TS, call: TS.CallLikeExpression): string {
  const callee = (call as TS.CallExpression).expression as TS.Expression | undefined;
  if (!callee) return "(call)";
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.name))
    return callee.name.text;
  return truncate(callee.getText());
}

/* ------------------------------------------------------------------------- */
/* One resolver per code. Each is justified in src/codes.ts.                  */
/* ------------------------------------------------------------------------- */

/**
 * TS2339 — `Property 'x' does not exist on type 'T'`.
 *
 * The subject is `T`, reached through the receiver of the property access rather
 * than parsed out of the message. This is what links 91 of the corpus's 99
 * TS2339 to one declaration in `src/shared/domain/result.ts`.
 */
function context2339(
  ts: typeof TS,
  checker: TS.TypeChecker,
  node: TS.Node,
  spanOf: SpanOf,
): DiagnosticContext | undefined {
  const access = node.parent;
  if (!access) return undefined;

  const receiver = ts.isPropertyAccessExpression(access)
    ? access.name === node
      ? access.expression
      : undefined
    : ts.isQualifiedName(access) && access.right === node
      ? access.left
      : undefined;
  if (!receiver) return undefined;

  const subject = symbolRefOfType(ts, checker, checker.getTypeAtLocation(receiver), spanOf);
  return subject ? { subject } : undefined;
}

/**
 * TS2353 — `Object literal may only specify known properties, and 'x' does not
 * exist in type 'T'`.
 *
 * Same cause as TS2339, different syntax: the type is the object literal's
 * *contextual* type, not the type of anything written down. Without this the
 * contract fixture folds nothing, because its cascade is spread over three
 * different codes on one interface.
 */
function context2353(
  ts: typeof TS,
  checker: TS.TypeChecker,
  node: TS.Node,
  spanOf: SpanOf,
): DiagnosticContext | undefined {
  for (let current: TS.Node | undefined = node; current; current = current.parent) {
    if (ts.isObjectLiteralExpression(current)) {
      const contextual = checker.getContextualType(current);
      if (!contextual) return undefined;
      const expected = symbolRefOfType(ts, checker, contextual, spanOf);
      if (!expected) return undefined;
      return {
        expected,
        actual: truncate(checker.typeToString(checker.getTypeAtLocation(current))),
      };
    }
    if (ts.isSourceFile(current)) return undefined;
  }
  return undefined;
}

/**
 * TS2345 — `Argument of type 'A' is not assignable to parameter of type 'B'`.
 *
 * `expected` is `B` with its declaration, `actual` is `A` as text. The parameter
 * type is the shared thing: in the contract fixture it is the very interface the
 * other two diagnostics name.
 */
function context2345(
  ts: typeof TS,
  checker: TS.TypeChecker,
  node: TS.Node,
  spanOf: SpanOf,
): DiagnosticContext | undefined {
  const call = enclosingCall(ts, node);
  if (!call) return undefined;

  const args = (call as TS.CallExpression).arguments;
  if (!args) return undefined;

  // The argument the diagnostic sits on — the one whose span contains the node.
  const argument = args.find(
    (candidate) => candidate.pos <= node.getStart() && node.getEnd() <= candidate.end,
  );
  if (!argument) return undefined;

  const signature = checker.getResolvedSignature(call);
  const parameter = signature?.parameters[args.indexOf(argument)];
  const parameterDeclaration = parameter?.declarations?.[0];
  if (!parameter || !parameterDeclaration) return undefined;

  const expectedType = checker.getTypeOfSymbolAtLocation(parameter, parameterDeclaration);
  const expected = symbolRefOfType(ts, checker, expectedType, spanOf);
  if (!expected) return undefined;

  return { expected, actual: truncate(checker.typeToString(checker.getTypeAtLocation(argument))) };
}

/**
 * TS2305 — `Module 'X' has no exported member 'Y'`.
 * TS2724 — the same thing, with a suggestion appended: `… Did you mean 'Z'?`
 *
 * The two share this resolver because they are one diagnostic: TypeScript picks
 * 2724 whenever the missing name has a near match among the module's real
 * exports, and 2305 otherwise. Which one fires is a property of the *names*
 * involved, not of the failure — the barrel fixture gets 2724 purely because
 * `Order` sits next to `OrderId`. Capturing only 2305 would have meant a
 * cascade folding or not depending on how the author spelled things.
 *
 * Measured before implementing, as the plan required: the `ProgramFacts.imports`
 * channel alone is *not* enough here. It carries specifiers **as written**, so
 * two files importing the same module through different relative paths — the
 * normal case — look unrelated, and resolving those paths inside the pipeline
 * would be exactly the guessing rule 4 exists to prevent (and would fail outright
 * on `paths` mappings and package specifiers).
 *
 * So the subject is the module, resolved: one `declaredAt` shared by every
 * importer. 12 of 12 on the corpus. `memberNames` carries what the module really
 * exports, which is what a TS2305 reader wants and TypeScript never prints.
 */
function context2305(
  ts: typeof TS,
  checker: TS.TypeChecker,
  node: TS.Node,
  spanOf: SpanOf,
): DiagnosticContext | undefined {
  const specifier = node.parent;
  if (!specifier || !(ts.isImportSpecifier(specifier) || ts.isExportSpecifier(specifier))) {
    return undefined;
  }

  const moduleSpecifier = moduleSpecifierOf(ts, specifier);
  const moduleSymbol = moduleSpecifier ? checker.getSymbolAtLocation(moduleSpecifier) : undefined;
  const declaration = moduleSymbol?.declarations?.[0];
  if (!moduleSpecifier || !moduleSymbol || !declaration) return undefined;

  const subject: SymbolRef = {
    // As written, so it can be checked against the message verbatim. Identity
    // travels in `declaredAt`, which is resolved and therefore shared.
    name: moduleSpecifier.text,
    kind: "module",
    declaredAt: declarationSpan(ts, declaration, spanOf),
  };

  const exports = checker.getExportsOfModule(moduleSymbol).map((symbol) => symbol.getName());
  if (exports.length > 0) subject.memberNames = exports;

  return { subject };
}

/**
 * TS2554 — `Expected N arguments, but got M`.
 *
 * The callee's own declaration, straight from the resolved signature. 152 of 152
 * on the corpus, all pointing at one arrow function.
 *
 * This is what makes the corpus's largest cascade foldable **without** loosening
 * §5.1. The obvious alternative was to treat the span of TypeScript's own
 * `relatedInformation` as a declaration site; that would have been a new kind of
 * evidence needing a spec amendment, where `getResolvedSignature().declaration`
 * is the ordinary structural link §5.1 rule 2 already talks about.
 */
function context2554(
  ts: typeof TS,
  checker: TS.TypeChecker,
  node: TS.Node,
  spanOf: SpanOf,
): DiagnosticContext | undefined {
  const call = enclosingCall(ts, node);
  const signature = call ? checker.getResolvedSignature(call) : undefined;
  const declaration = signature?.declaration;
  if (!call || !signature || !declaration) return undefined;

  return {
    subject: {
      name: calleeName(ts, call),
      kind: declarationKind(ts, declaration),
      declaredAt: declarationSpan(ts, declaration, spanOf),
      signature: truncate(checker.signatureToString(signature)),
    },
  };
}

/**
 * TS2741 — `Property 'x' is missing in type 'S' but required in type 'T'`.
 * TS2739 — the same failure with two to five missing: `… is missing the
 * following properties from type 'T': a, b`.
 * TS2740 — the same again from six missing, listing four and counting the rest:
 * `…: a, b, c, d, and 2 more.`
 *
 * One resolver, because the three are one failure counted three ways:
 * TypeScript picks 2741 at exactly one missing property, 2739 from two to five
 * and 2740 from six. Which code fires is a property of *how many* members were
 * forgotten and not of what went wrong, so splitting them would make an
 * identical cascade fold or not depending on whether someone dropped one field
 * or six — the same trap 2305/2724 set, and the reason `src/codes.ts` records
 * that lesson.
 *
 * `missing` is filled for all three and read only by 2740, the one that
 * truncates. Filling it uniformly costs one `getPropertiesOfType` on a type the
 * resolver already holds, and keeps the field's meaning independent of which
 * code happened to fire.
 *
 * `expected` is `T`, the target type, which is the shared cause: N construction
 * sites of one interface break together when that interface gains a required
 * member. Two node shapes reach here and both are handled explicitly rather
 * than by a downward search for an object literal — a search would pick a
 * nested literal on the way and point at the wrong type:
 *
 *  - the **name of a variable declaration** (`const origin: Rect = { … }`),
 *    where the type at that location already *is* the target;
 *  - a **return statement** (`return { x, y }`), where it is the enclosing
 *    function's declared return type. `getTypeAtLocation` on the statement
 *    yields `any`, so this branch is not an optimisation but the only way the
 *    case resolves at all — measured on the two fixtures, 2 of 6 diagnostics.
 *
 * Anything else returns `undefined` and degrades to the native format (rule 5).
 */
function context2739(
  ts: typeof TS,
  checker: TS.TypeChecker,
  node: TS.Node,
  spanOf: SpanOf,
): DiagnosticContext | undefined {
  let target: TS.Type | undefined;
  let supplied: TS.Expression | undefined;

  if (ts.isReturnStatement(node)) {
    let fn: TS.Node | undefined = node.parent;
    while (fn && !ts.isFunctionLike(fn)) fn = fn.parent;
    const signature = fn
      ? checker.getSignatureFromDeclaration(fn as TS.SignatureDeclaration)
      : undefined;
    target = signature ? checker.getReturnTypeOfSignature(signature) : undefined;
    supplied = node.expression;
  } else if (node.parent && ts.isVariableDeclaration(node.parent) && node.parent.name === node) {
    target = checker.getTypeAtLocation(node);
    supplied = node.parent.initializer;
  }

  if (!target) return undefined;
  const expected = symbolRefOfType(ts, checker, target, spanOf);
  if (!expected) return undefined;

  const context: DiagnosticContext = { expected };

  // The members TypeScript counted but, on TS2740, did not all name. Optional
  // ones are excluded because their absence is not what was reported: an
  // optional member missing raises nothing, so listing it would put a name in
  // front of the reader that no diagnostic is about.
  if (supplied) {
    const suppliedType = checker.getTypeAtLocation(supplied);
    const missing = checker
      .getPropertiesOfType(target)
      .filter((property) => (property.flags & ts.SymbolFlags.Optional) === 0)
      .filter((property) => !suppliedType.getProperty(property.getName()))
      .map((property) => property.getName());
    if (missing.length > 0) context.missing = missing;
  }

  return context;
}

/**
 * TS2322 — `Type 'A' is not assignable to type 'B'`.
 *
 * `B` is the shared cause, and this is the fixture that proves the point twice
 * over. `assignability-mismatch` exists as the counter-example that forbids
 * keying on a `related` span: two of its three diagnostics carry a related
 * naming the `currency` *property* of `Rate` — correct code, three lines below
 * the union that actually lost a member — and the third carries no related at
 * all. Resolving the **contextual type** instead lands all three on
 * `type Currency` itself, at the exact line `meta.json` names as the root cause.
 * 3 of 3, measured 2026-08-02.
 *
 * The handle is uniform, and deliberately one concept rather than a list of
 * syntactic cases: *the expression that was checked against something*, then
 * what it was checked against. A property assignment's initialiser, a variable
 * declaration's initialiser, a return statement's expression, or the node
 * itself when it is already an expression.
 *
 * `unconstrained-generic` is the witness that this stays honest where it should
 * not fold: its lone TS2322 resolves to `Map` in `lib.es2015.collection.d.ts`,
 * which §5.1's "a declaration outside the program's files cannot be a cause"
 * guard refuses. That guard was written in P1 for a corpus TS2345 that resolved
 * the same way, and it catches this one for free.
 */
function context2322(
  ts: typeof TS,
  checker: TS.TypeChecker,
  node: TS.Node,
  spanOf: SpanOf,
): DiagnosticContext | undefined {
  const parent = node.parent;
  let assigned: TS.Expression | undefined;

  if (parent && ts.isPropertyAssignment(parent) && parent.name === node) {
    assigned = parent.initializer;
  } else if (parent && ts.isVariableDeclaration(parent) && parent.name === node) {
    assigned = parent.initializer;
  } else if (ts.isReturnStatement(node)) {
    assigned = node.expression;
  } else if (ts.isExpression(node)) {
    assigned = node;
  }

  const contextual = assigned ? checker.getContextualType(assigned) : undefined;
  if (!contextual) return undefined;

  const expected = symbolRefOfType(ts, checker, contextual, spanOf);
  if (!expected) return undefined;

  return {
    expected,
    actual: truncate(checker.typeToString(checker.getTypeAtLocation(assigned as TS.Expression))),
  };
}

type Resolver = (
  ts: typeof TS,
  checker: TS.TypeChecker,
  node: TS.Node,
  spanOf: SpanOf,
) => DiagnosticContext | undefined;

const RESOLVERS: Record<number, Resolver | undefined> = {
  2305: context2305,
  2322: context2322,
  // Same resolver, same shape — see the comment on `context2305`.
  2724: context2305,
  2339: context2339,
  2345: context2345,
  2353: context2353,
  2554: context2554,
  2739: context2739,
  // Same resolver, same failure — see the comment on `context2739`.
  2740: context2739,
  2741: context2739,
};

/**
 * Resolve the context for one diagnostic, or `undefined`.
 *
 * `spanOf` is injected rather than imported so that path normalisation stays in
 * one place: a `declaredAt` produced here must be byte-identical to a `primary`
 * produced there, or causality's identity comparison silently stops matching.
 */
export function resolveContext(
  ts: typeof TS,
  checker: TS.TypeChecker,
  diagnostic: TS.Diagnostic,
  spanOf: SpanOf,
): DiagnosticContext | undefined {
  const resolve = RESOLVERS[diagnostic.code];
  if (!resolve || !diagnostic.file || diagnostic.start === undefined) return undefined;

  const node = nodeAt(ts, diagnostic.file, diagnostic.start);
  if (!node) return undefined;

  try {
    return resolve(ts, checker, node, spanOf);
  } catch {
    // A checker call that throws on an exotic node must not take the whole run
    // down: the diagnostic is still reported, just without context (rule 5).
    return undefined;
  }
}
