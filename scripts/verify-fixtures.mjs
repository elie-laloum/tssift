#!/usr/bin/env node

/*
 * Fixture guard: every `fixtures/<name>/before/` must actually fail to compile,
 * under both ends of the supported range. A fixture that compiles is not a
 * fixture.
 *
 * Both compilers are loaded through the TypeScript API rather than the `tsc`
 * binary: `typescript` and `typescript-5.4` both ship a bin named `tsc`, so
 * `node_modules/.bin/tsc` is whichever one bun linked last — invisible, and
 * exactly the kind of silent version drift AGENTS.md rule 12 exists to stop.
 *
 * Usage:
 *   node scripts/verify-fixtures.mjs            # check only
 *   node scripts/verify-fixtures.mjs --print    # dump each diagnostic tree
 */

import { readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturesRoot = join(repoRoot, "fixtures");
const print = process.argv.includes("--print");

/** The ends and the middle of the declared support range (PROJECT.md §9.2, axis 1). */
const COMPILERS = ["typescript-5.4", "typescript", "typescript-6"];

function loadDiagnostics(ts, beforeDir) {
  const configPath = join(beforeDir, "tsconfig.json");
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error) {
    throw new Error(
      `unreadable tsconfig: ${ts.flattenDiagnosticMessageText(read.error.messageText, " ")}`,
    );
  }
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, beforeDir);
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  return ts.getPreEmitDiagnostics(program);
}

function describe(ts, diagnostic) {
  const lines = [];
  const at = diagnostic.file
    ? (() => {
        const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
          diagnostic.start ?? 0,
        );
        const rel = diagnostic.file.fileName.replace(`${repoRoot}/`, "");
        return `${rel}:${line + 1}:${character + 1}`;
      })()
    : "<no file>";
  lines.push(`  ${at} TS${diagnostic.code}`);

  const walk = (node, depth) => {
    if (typeof node === "string") {
      lines.push(`    ${"  ".repeat(depth)}[${depth}] ${node}`);
      return;
    }
    lines.push(`    ${"  ".repeat(depth)}[${depth}] TS${node.code}: ${node.messageText}`);
    for (const child of node.next ?? []) walk(child, depth + 1);
  };
  walk(diagnostic.messageText, 0);

  for (const related of diagnostic.relatedInformation ?? []) {
    const where = related.file
      ? (() => {
          const { line, character } = related.file.getLineAndCharacterOfPosition(
            related.start ?? 0,
          );
          return `${related.file.fileName.replace(`${repoRoot}/`, "")}:${line + 1}:${character + 1}`;
        })()
      : "<no file>";
    lines.push(
      `    related ${where} TS${related.code}: ${ts.flattenDiagnosticMessageText(related.messageText, " ")}`,
    );
  }
  return lines.join("\n");
}

const fixtures = readdirSync(fixturesRoot)
  .filter((name) => statSync(join(fixturesRoot, name)).isDirectory())
  .sort();

if (fixtures.length === 0) {
  console.error("no fixtures found");
  process.exit(1);
}

let failed = false;

for (const fixture of fixtures) {
  const beforeDir = join(fixturesRoot, fixture, "before");
  for (const compiler of COMPILERS) {
    const ts = require(compiler);
    let diagnostics;
    try {
      diagnostics = loadDiagnostics(ts, beforeDir);
    } catch (error) {
      console.error(`FAIL ${fixture} @ ts${ts.version}: ${error.message}`);
      failed = true;
      continue;
    }
    const codes = [...new Set(diagnostics.map((d) => d.code))].sort((a, b) => a - b);
    const verdict = diagnostics.length === 0 ? "FAIL (compiles clean)" : "ok";
    if (diagnostics.length === 0) failed = true;
    console.log(
      `${verdict.padEnd(21)} ${fixture.padEnd(26)} ts${ts.version.padEnd(7)} ${diagnostics.length} diag  codes: ${codes.join(", ") || "-"}`,
    );
    if (print) {
      for (const diagnostic of diagnostics) console.log(describe(ts, diagnostic));
      console.log("");
    }
  }
}

process.exit(failed ? 1 : 0);
