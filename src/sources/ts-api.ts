import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type * as TS from "typescript";
import { TssiftUnrunnable } from "../errors.js";
import type {
  MessageChainNode,
  NormalizedDiagnostic,
  ProgramFacts,
  RelatedInfo,
  SourceSpan,
} from "../types.js";
import type { DiagnosticSource, LoadOptions, SourceResult } from "./index.js";

/** The peer range. Anything outside it exits 2 rather than guessing (rule 7, rule 15). */
export const SUPPORTED_TYPESCRIPT_RANGE = ">=5.4 <6";

/**
 * A filename that never exists, used only as the base from which `createRequire`
 * resolves. It must sit *inside* the analysed project so that `typescript`
 * resolves the way the user's own `tsc` does — not the way our install does.
 */
const RESOLUTION_ANCHOR = "__tssift_resolution_anchor__.cjs";

/** Sentinel for a diagnostic that carries no file at all (TS 7 allows this). */
export const NO_FILE = "<none>";

/** Sentinel prefix for files inside the loaded compiler's own lib directory. */
export const TS_LIB_PREFIX = "<ts-lib>";

export function isSupportedTypeScriptVersion(version: string): boolean {
  const match = /^(\d+)\.(\d+)\./.exec(version);
  if (!match) return false;
  const major = Number(match[1] ?? "");
  const minor = Number(match[2] ?? "");
  return major === 5 && minor >= 4;
}

/** POSIX separators, always. A snapshot carrying a backslash dies on the next machine. */
function toPosix(path: string): string {
  return path.replaceAll("\\", "/");
}

/**
 * Absolute path → the form that goes in a `SourceSpan`.
 *
 * Order matters: the compiler's lib directory usually sits *inside* a
 * `node_modules/`, so it has to be recognised first.
 */
export function normalizeFilePath(absolute: string, root: string, tsLibDir: string): string {
  const path = toPosix(absolute);
  const libDir = toPosix(tsLibDir);

  if (path.startsWith(`${libDir}/`)) {
    return `${TS_LIB_PREFIX}/${path.slice(libDir.length + 1)}`;
  }

  const marker = "/node_modules/";
  const lastNodeModules = path.lastIndexOf(marker);
  if (lastNodeModules !== -1) {
    return `node_modules/${path.slice(lastNodeModules + marker.length)}`;
  }

  // Relative to the tsconfig's directory — including when that means climbing
  // out with `../`, which still leaks no home directory into a snapshot.
  return toPosix(relative(root, absolute)) || ".";
}

/** sha256(code|file|line|col|message), first 12 hex (PROJECT.md §4). */
export function diagnosticId(
  code: number,
  file: string,
  line: number,
  column: number,
  message: string,
): string {
  return createHash("sha256")
    .update(`${code}|${file}|${line}|${column}|${message}`)
    .digest("hex")
    .slice(0, 12);
}

function categoryOf(
  ts: typeof TS,
  category: TS.DiagnosticCategory,
): NormalizedDiagnostic["category"] {
  switch (category) {
    case ts.DiagnosticCategory.Error:
      return "error";
    case ts.DiagnosticCategory.Warning:
      return "warning";
    case ts.DiagnosticCategory.Suggestion:
      return "suggestion";
    default:
      return "message";
  }
}

/** The head node's own text — not the flattened chain. The chain is carried separately. */
function headText(messageText: string | TS.DiagnosticMessageChain): string {
  return typeof messageText === "string" ? messageText : messageText.messageText;
}

/**
 * Prefix traversal of the message chain, depth preserved, head excluded.
 *
 * The head lives in `message` and `code`, so starting at depth 1 keeps the
 * encoding lossless without duplicating the head into `chain[0]`. Prefix order
 * plus depth reconstructs the tree exactly — including a branching one, which
 * is what TS2769 produces.
 */
function flattenChain(messageText: string | TS.DiagnosticMessageChain): MessageChainNode[] {
  if (typeof messageText === "string") return [];
  const nodes: MessageChainNode[] = [];
  const walk = (node: TS.DiagnosticMessageChain, depth: number): void => {
    nodes.push({ text: node.messageText, code: node.code, depth });
    for (const child of node.next ?? []) walk(child, depth + 1);
  };
  for (const child of messageText.next ?? []) walk(child, 1);
  return nodes;
}

function spanOf(
  file: TS.SourceFile,
  start: number,
  length: number,
  root: string,
  tsLibDir: string,
): SourceSpan {
  const from = file.getLineAndCharacterOfPosition(start);
  const to = file.getLineAndCharacterOfPosition(start + length);
  const lineStarts = file.getLineStarts();
  const lineStart = lineStarts[from.line] ?? 0;
  const lineEnd = lineStarts[from.line + 1] ?? file.text.length;

  return {
    file: normalizeFilePath(file.fileName, root, tsLibDir),
    // The TS API is 0-indexed; the conversion happens here and only here.
    line: from.line + 1,
    column: from.character + 1,
    endLine: to.line + 1,
    endColumn: to.character + 1,
    snippet: file.text.slice(lineStart, lineEnd).trim(),
  };
}

function relatedOf(
  ts: typeof TS,
  diagnostic: TS.Diagnostic,
  root: string,
  tsLibDir: string,
): RelatedInfo[] {
  return (diagnostic.relatedInformation ?? []).map((related) => {
    const entry: RelatedInfo = {
      // Flattened with a space: rule 10 of the plan forbids a wrapped line.
      message: ts.flattenDiagnosticMessageText(related.messageText, " "),
      code: related.code,
    };
    if (related.file) {
      entry.span = spanOf(related.file, related.start ?? 0, related.length ?? 0, root, tsLibDir);
    }
    return entry;
  });
}

function normalize(
  ts: typeof TS,
  diagnostic: TS.Diagnostic,
  root: string,
  tsLibDir: string,
): NormalizedDiagnostic {
  const primary: SourceSpan = diagnostic.file
    ? spanOf(diagnostic.file, diagnostic.start ?? 0, diagnostic.length ?? 0, root, tsLibDir)
    : { file: NO_FILE, line: 1, column: 1 };

  const message = headText(diagnostic.messageText);

  return {
    id: diagnosticId(diagnostic.code, primary.file, primary.line, primary.column, message),
    code: diagnostic.code,
    category: categoryOf(ts, diagnostic.category),
    primary,
    message,
    chain: flattenChain(diagnostic.messageText),
    related: relatedOf(ts, diagnostic, root, tsLibDir),
    // `context` stays absent while CONTEXT_CAPTURE_CODES is empty (P0). The
    // mechanism is the `captureFor` parameter, honoured below.
  };
}

/** Deterministic order. Without it the program's own order leaks into snapshots. */
function sortDiagnostics(diagnostics: NormalizedDiagnostic[]): NormalizedDiagnostic[] {
  return [...diagnostics].sort(
    (a, b) =>
      a.primary.file.localeCompare(b.primary.file) ||
      a.primary.line - b.primary.line ||
      a.primary.column - b.primary.column ||
      a.code - b.code ||
      a.message.localeCompare(b.message),
  );
}

interface LoadedCompiler {
  ts: typeof TS;
  path: string;
  libDir: string;
}

function loadCompiler(projectDir: string): LoadedCompiler {
  const require = createRequire(join(projectDir, RESOLUTION_ANCHOR));

  let resolvedPath: string;
  try {
    resolvedPath = require.resolve("typescript");
  } catch {
    throw new TssiftUnrunnable(
      `Cannot resolve "typescript" from the analysed project.\n` +
        `  looked up: "typescript"\n` +
        `  resolving from: ${projectDir}\n` +
        `tssift type-checks with the project's own compiler, never with its own copy: ` +
        `a different compiler would report diagnostics that the project's tsc does not.\n` +
        `Install typescript ${SUPPORTED_TYPESCRIPT_RANGE} in the project, or point --project at a project that has one.`,
    );
  }

  // The module is CommonJS and is loaded through the project's own require, so
  // the value is whatever compiler the project resolves. Shape-checked below
  // rather than trusted.
  const compiler = require("typescript") as typeof TS;
  const version: unknown = compiler.version;

  if (typeof version !== "string") {
    throw new TssiftUnrunnable(
      `Resolved "typescript" but it reports no version.\n` +
        `  resolved: ${resolvedPath}\n` +
        `  resolving from: ${projectDir}\n` +
        `tssift supports typescript ${SUPPORTED_TYPESCRIPT_RANGE}.`,
    );
  }

  if (!isSupportedTypeScriptVersion(version)) {
    throw new TssiftUnrunnable(
      `Unsupported TypeScript version.\n` +
        `  resolved: typescript ${version}\n` +
        `  at: ${resolvedPath}\n` +
        `  resolving from: ${projectDir}\n` +
        `tssift v1 supports ${SUPPORTED_TYPESCRIPT_RANGE}. TypeScript 6 and 7 are refused rather than ` +
        `degraded: the 7.x Go port no longer exposes ts.createProgram, and guessing would report ` +
        `diagnostics the project's own tsc does not.`,
    );
  }

  if (typeof compiler.createProgram !== "function") {
    throw new TssiftUnrunnable(
      `Resolved typescript ${version} at ${resolvedPath}, but it does not expose createProgram.\n` +
        `tssift supports ${SUPPORTED_TYPESCRIPT_RANGE} through the classic compiler API.`,
    );
  }

  return { ts: compiler, path: resolvedPath, libDir: dirname(resolvedPath) };
}

function resolveConfigPath(project: string): string {
  const absolute = isAbsolute(project) ? project : resolve(process.cwd(), project);
  let stats: ReturnType<typeof statSync>;
  try {
    stats = statSync(absolute);
  } catch {
    throw new TssiftUnrunnable(
      `tsconfig not found.\n  looked for: ${absolute}\n` +
        `--project is taken as given; tssift does not search parent directories.`,
    );
  }
  return stats.isDirectory() ? join(absolute, "tsconfig.json") : absolute;
}

/**
 * A reference path as it should be typed back into `--project`: relative to the
 * tsconfig's own directory, POSIX separators, explicitly relative.
 */
function referenceLabel(absolute: string, root: string): string {
  const path = toPosix(relative(root, absolute));
  if (path === "") return ".";
  return path.startsWith(".") ? path : `./${path}`;
}

/**
 * The solution-tsconfig hole (PROJECT.md §9, decided 2026-07-27).
 *
 * A monorepo root with `"files": []`, `"include": []`, `"references": [...]`
 * makes `tsc -p` type-check nothing and exit 0. Reproducing that zero verbatim
 * would print `0 errors` over a whole repository whose errors are real but live
 * in the referenced projects — a false clean, the worst failure mode for a
 * diagnostic tool, and the silent fallback rule 15 forbids.
 *
 * The discriminator is `references`, and only `references`:
 *  - no files + references declared ⇒ exit 2, naming where to point instead;
 *  - no files + no reference ⇒ a legitimate empty project, exit 0. Refusing it
 *    would be our own false negative. What rule 15 forbids is not a `0`, it is
 *    a *false* `0`.
 *
 * Project references stay out of scope for v0.1 — which is exactly why they get
 * named rather than guessed at.
 */
function assertSomethingToCheck(
  configPath: string,
  root: string,
  parsed: TS.ParsedCommandLine,
): void {
  if (parsed.fileNames.length > 0) return;

  const references = parsed.projectReferences ?? [];
  if (references.length === 0) return;

  const labels = references.map((reference) => referenceLabel(reference.path, root));
  const shown = labels.slice(0, 12);
  const rest = labels.length - shown.length;

  throw new TssiftUnrunnable(
    `Nothing to type-check.\n` +
      `  tsconfig: ${configPath}\n` +
      `  0 files matched, ${references.length} project reference${
        references.length === 1 ? "" : "s"
      } declared\n` +
      `tssift analyses one project at a time; project references are not supported.\n` +
      `Point --project at one of: ${shown.join(", ")}${rest > 0 ? `, +${rest} more` : ""}`,
  );
}

/** Module specifiers as written, per file. */
function collectImports(ts: typeof TS, file: TS.SourceFile): string[] {
  const specifiers: string[] = [];
  for (const statement of file.statements) {
    if (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) {
      const specifier = statement.moduleSpecifier;
      if (specifier && ts.isStringLiteral(specifier)) specifiers.push(specifier.text);
    } else if (
      ts.isImportEqualsDeclaration(statement) &&
      ts.isExternalModuleReference(statement.moduleReference) &&
      ts.isStringLiteral(statement.moduleReference.expression)
    ) {
      specifiers.push(statement.moduleReference.expression.text);
    }
  }
  return specifiers;
}

export class TsApiSource implements DiagnosticSource {
  load(options: LoadOptions): SourceResult {
    const configPath = resolveConfigPath(options.project);
    const root = dirname(configPath);
    const { ts, path: compilerPath, libDir } = loadCompiler(root);

    const read = ts.readConfigFile(configPath, ts.sys.readFile);
    if (read.error) {
      throw new TssiftUnrunnable(
        `Cannot read tsconfig.\n  file: ${configPath}\n  ` +
          `${ts.flattenDiagnosticMessageText(read.error.messageText, " ")}`,
      );
    }

    const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, root, undefined, configPath);
    assertSomethingToCheck(configPath, root, parsed);

    const program = ts.createProgram({
      rootNames: parsed.fileNames,
      options: parsed.options,
      projectReferences: parsed.projectReferences,
      // Passing them here is what makes getPreEmitDiagnostics report tsconfig
      // errors too. Dropping them would let tssift exit 0 on a project where
      // tsc exits 1 — the one divergence a diagnostic tool cannot afford.
      configFileParsingDiagnostics: parsed.errors,
    });

    const diagnostics = ts
      .getPreEmitDiagnostics(program)
      .map((diagnostic) => normalize(ts, diagnostic, root, libDir));

    const files: string[] = [];
    const imports: Record<string, string[]> = {};
    for (const file of program.getSourceFiles()) {
      const normalized = normalizeFilePath(file.fileName, root, libDir);
      if (normalized.startsWith(`${TS_LIB_PREFIX}/`) || normalized.startsWith("node_modules/")) {
        continue;
      }
      files.push(normalized);
      imports[normalized] = collectImports(ts, file);
    }
    files.sort();

    const facts: ProgramFacts = {
      root,
      files,
      imports,
      typescript: { version: ts.version, path: compilerPath },
    };

    // P0 captures no context: CONTEXT_CAPTURE_CODES is empty, so this loop is
    // empty too. The mechanism is what ships now; P1 adds numbers to the list
    // without touching this file.
    void options.captureFor;

    return { diagnostics: sortDiagnostics(diagnostics), facts };
  }
}
