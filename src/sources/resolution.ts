/**
 * How a module specifier resolves in the analysed project — the `ProgramFacts`
 * channel the TS2307 enricher is built on.
 *
 * ## Why this is a source, and could not be anything else
 *
 * TS2307's payload is not in the diagnostic. `Cannot find module 'qs' or its
 * corresponding type declarations.` is the **same sentence under all four
 * installers**, while the truth behind it is installer-specific: undeclared but
 * hoisted, undeclared and unreachable, declared but resolved through a map the
 * compiler never loaded, or mapped by a `paths` line pointing at a folder that
 * was renamed. Everything that separates those cases lives in files, so a
 * pipeline stage cannot reach it (rule 4, purity) and the reading has to happen
 * here, once per program, at ingestion.
 *
 * ## What it is allowed to read (rule 10)
 *
 * Declarative files, and the *presence* of directories — never a package
 * manager, never a subprocess, and never on the presumption that
 * `node_modules/` exists at all: under Yarn PnP there is none, which is itself
 * one of the facts this module reports.
 *
 * Concretely: `package.json` (parsed), the lockfile **names** at the project
 * root, whether `.pnp.cjs` is there, whether `node_modules/` is there, and the
 * `paths` / `baseUrl` the compiler was configured with. Nothing walks
 * `node_modules/.pnpm/`, and no lockfile is *parsed* — `pnpm-lock.yaml` would
 * need a YAML parser, i.e. the first runtime dependency, to answer a question
 * that `package.json` already answers well enough.
 *
 * Every field below is something we looked at and found, or looked at and did
 * not find. Nothing here is inferred.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { DeclaredDependency, Installer, ResolutionFacts } from "../types.js";

/** Lockfile name → the installer that writes it. */
const LOCKFILES: ReadonlyArray<readonly [string, Installer]> = [
  ["package-lock.json", "npm"],
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
];

/**
 * Yarn's resolution map. `.pnp.cjs` is what Yarn >= 3 writes; `.pnp.js` is the
 * Yarn 2 name, still found in projects that never migrated.
 */
const PNP_FILES = [".pnp.cjs", ".pnp.js"] as const;

/** The four fields npm gives a resolvable meaning to, in the order they are reported. */
const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * `package.json`'s declared dependencies, or `undefined` when there is no
 * readable manifest.
 *
 * The difference matters and is why this returns `undefined` rather than `{}`:
 * "the manifest declares nothing" and "we could not read a manifest" support
 * opposite claims, and only the first licenses saying a package is *not*
 * declared. An unreadable or malformed manifest degrades to the second (rule 5).
 *
 * The lookup is next to the tsconfig and does not climb — the same policy
 * `--project` follows. A guessed parent would let us report "not declared"
 * against a manifest that is not the one governing this project.
 */
function readManifest(root: string): Record<string, DeclaredDependency> | undefined {
  let raw: string;
  try {
    raw = readFileSync(join(root, "package.json"), "utf8");
  } catch {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null) return undefined;

  const manifest = parsed as Record<string, unknown>;
  const declared: Record<string, DeclaredDependency> = {};

  // First field wins: a package in both `dependencies` and `devDependencies` is
  // reported as a dependency, which is the one that governs whether shipping
  // code may import it.
  for (const field of DEPENDENCY_FIELDS) {
    const entries = manifest[field];
    if (typeof entries !== "object" || entries === null) continue;
    for (const [name, range] of Object.entries(entries as Record<string, unknown>)) {
      if (typeof range !== "string" || name in declared) continue;
      declared[name] = { field, range };
    }
  }

  return declared;
}

interface CompilerPaths {
  paths?: Record<string, readonly string[]>;
  /** Absolute, as the compiler resolved it. Normalised against `root` here. */
  baseUrl?: string;
}

export function readResolutionFacts(root: string, compiler: CompilerPaths): ResolutionFacts {
  const lockfiles = LOCKFILES.filter(([name]) => existsSync(join(root, name))).map(
    ([name]) => name,
  );

  // Named only when a single lockfile answers. Two lockfiles at one root is a
  // real and ambiguous state, and picking a winner by priority would be a guess
  // printed as a fact — the lockfile list is reported instead, and says more.
  const single =
    lockfiles.length === 1 ? LOCKFILES.find(([name]) => name === lockfiles[0]) : undefined;

  const facts: ResolutionFacts = {
    installer: single?.[1] ?? "unknown",
    lockfiles,
    pnp: PNP_FILES.some((name) => existsSync(join(root, name))),
    nodeModules: isDirectory(join(root, "node_modules")),
    paths: compiler.paths ?? {},
  };

  const dependencies = readManifest(root);
  if (dependencies) facts.dependencies = dependencies;

  if (compiler.baseUrl !== undefined) {
    facts.baseUrl = (relative(root, compiler.baseUrl) || ".").replaceAll("\\", "/");
  }

  return facts;
}
