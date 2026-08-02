/**
 * TS2307 — `Cannot find module 'X' or its corresponding type declarations.`
 *
 * The one code in §5.2 whose payload is not about types at all. TypeScript
 * prints the same sentence under npm, pnpm, yarn and bun, and it is true in all
 * four while meaning something different in each: undeclared but hoisted into
 * reach, undeclared and unreachable, declared and installed but resolved
 * through a map this process never loaded, or mapped by a `paths` line that
 * points at a folder somebody renamed. The compiler does not read any of that,
 * so it cannot say which one happened — and the reader in a terminal has no
 * `node_modules` to look at either.
 *
 * `ProgramFacts.resolution` is that reading, done once per program by the source
 * (rule 4). This file only decides which of it bears on *this* specifier.
 *
 * ## Three facts, and the reason there are not more
 *
 *  1. **The `paths` mapping**, when the specifier matches one. This is the only
 *     fact in tssift that names a cause living outside every program file: a
 *     line of `tsconfig.json`, which no `declaredAt` can ever point at. On
 *     `wrong-tsconfig-paths` it is the whole answer.
 *  2. **Whether package.json declares the package** — and when it does, the
 *     field and the range. Both directions are load-bearing and they are not
 *     symmetric. "Not declared" is the phantom-dependency case; "declared as
 *     1.2.0" is what refutes the reading a reader arrives at by default, and it
 *     is the fact that makes `yarn-pnp-project` legible at all.
 *  3. **How the project is installed**: the installer its lockfile names,
 *     whether a `.pnp.cjs` is present, whether there is a `node_modules` at all.
 *
 * What is deliberately **not** produced:
 *
 *  - **Any claim about what is installed on disk.** `qs` really is present in
 *    `phantom-dependency-pnpm`, one level down under `node_modules/.pnpm/`, and
 *    saying so would be the single most useful line here. It is not said,
 *    because reaching it means either walking pnpm's internal layout — a
 *    private convention, not a declarative file (rule 10) — or parsing
 *    `pnpm-lock.yaml`, which means a YAML parser, i.e. the first runtime
 *    dependency, for one code. The installer and the missing declaration are
 *    reported instead; between them the case is identifiable, and every word is
 *    checkable against a file.
 *  - **What each installer does with an undeclared package.** That hoisting
 *    reaches it under npm and pnpm's layout does not is true, documented, and
 *    not a fact *about this project* — stating it is where a fact turns into an
 *    explanation, and an explanation one step from a prescription (rule 1).
 *  - **Anything at all when the manifest could not be read.** Absence of a
 *    `dependencies` map means we did not get to look, not that nothing was
 *    declared, and only the second licenses saying a package is missing
 *    (rule 5). `two-independent-roots`, which has no package.json, therefore
 *    keeps its lone TS2307 in the native format — the right outcome.
 */
import type { Fact, NormalizedDiagnostic, ProgramFacts, ResolutionFacts } from "../../types.js";
import { unresolvedSpecifier } from "../causality.js";

/**
 * The package a bare specifier belongs to: `qs` from `qs/lib/parse`,
 * `@acme/http` from `@acme/http/client`. A scope keeps two segments, everything
 * else keeps one.
 */
export function packageOf(specifier: string): string {
  const parts = specifier.split("/");
  if (specifier.startsWith("@")) return parts.slice(0, 2).join("/");
  return parts[0] ?? specifier;
}

/**
 * Does `specifier` match a tsconfig `paths` pattern?
 *
 * TypeScript's own rule, and the reason it cannot be a plain equality: a pattern
 * holds at most one `*`, an exact pattern matches only itself, and when several
 * wildcard patterns match, the longest prefix before the `*` wins. Transcribed
 * rather than approximated — reporting the wrong one of two overlapping
 * patterns would name the wrong tsconfig line.
 */
export function matchingPathPattern(
  specifier: string,
  paths: Record<string, readonly string[]>,
): string | undefined {
  let best: string | undefined;
  let bestPrefix = -1;

  for (const pattern of Object.keys(paths)) {
    const star = pattern.indexOf("*");
    if (star === -1) {
      if (pattern === specifier) return pattern;
      continue;
    }
    const prefix = pattern.slice(0, star);
    const suffix = pattern.slice(star + 1);
    if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) continue;
    if (specifier.length < prefix.length + suffix.length) continue;
    if (prefix.length > bestPrefix) {
      best = pattern;
      bestPrefix = prefix.length;
    }
  }

  return best;
}

/** `'src/lib/*'`, or `'src/lib/*' · 'vendor/*'` when the pattern has several targets. */
function targetList(targets: readonly string[]): string {
  return targets.map((target) => `'${target}'`).join(" · ");
}

/**
 * `pnpm-lock.yaml`, or `package-lock.json + bun.lock` when the root carries
 * more than one — in which case the installer itself is reported as unknown and
 * the list is the more honest statement of what is there.
 */
function lockfileList(lockfiles: readonly string[]): string {
  return lockfiles.join(" + ");
}

function installLine(resolution: ResolutionFacts): string | undefined {
  const { installer, lockfiles, pnp, nodeModules } = resolution;

  const observations: string[] = [];
  if (installer !== "unknown")
    observations.push(`installer: ${installer} (${lockfileList(lockfiles)})`);
  else if (lockfiles.length > 0) observations.push(`lockfiles: ${lockfileList(lockfiles)}`);

  // Only worth a word when it is the unusual state. "node_modules exists" is
  // the default everywhere and says nothing; "there is none" is the whole
  // explanation under PnP, and next to a lockfile it also flags a project that
  // was never installed.
  if (pnp) {
    observations.push(
      nodeModules
        ? "'.pnp.cjs' at the project root, alongside a node_modules directory"
        : "'.pnp.cjs' at the project root, and no node_modules directory",
    );
  } else if (!nodeModules) {
    observations.push("no node_modules directory at the project root");
  }

  return observations.length > 0 ? observations.join("; ") : undefined;
}

export function enrich2307(diagnostic: NormalizedDiagnostic, facts: ProgramFacts): Fact[] {
  // The same guard the grouping half uses, deliberately: a specifier the
  // imports table cannot confirm gets no facts here either, rather than facts
  // about a string parsed out of a message we may have misread.
  const specifier = unresolvedSpecifier(diagnostic, facts.imports);
  if (!specifier) return [];

  const { resolution } = facts;
  const produced: Fact[] = [];

  // A specifier the tsconfig maps is an alias for a path inside the project,
  // not a package, and the two explanations are mutually exclusive. Reporting
  // the mapping *and* "not declared in package.json" would attach a second,
  // true-but-irrelevant sentence to every aliased import — an alias is never in
  // a manifest, so its absence there is not news about anything.
  const pattern = matchingPathPattern(specifier, resolution.paths);
  if (pattern) {
    const base = resolution.baseUrl ? `, baseUrl '${resolution.baseUrl}'` : "";
    return [
      {
        kind: "origin",
        text: `'${specifier}' matches the tsconfig 'paths' pattern '${pattern}', mapped to ${targetList(
          resolution.paths[pattern] ?? [],
        )}${base}`,
      },
    ];
  }

  const { dependencies } = resolution;
  if (dependencies) {
    const name = packageOf(specifier);
    const declared = dependencies[name];
    produced.push({
      kind: "origin",
      text: declared
        ? `'${name}' is declared in ${declared.field} of package.json as '${declared.range}'`
        : `'${name}' is not declared in the dependencies, devDependencies, peerDependencies ` +
          `or optionalDependencies of package.json`,
    });
  }

  const install = installLine(resolution);
  if (install) produced.push({ kind: "origin", text: install });

  return produced;
}
