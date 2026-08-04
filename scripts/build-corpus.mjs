#!/usr/bin/env node

/*
 * Materialises the real broken corpus described by eval/corpus.json.
 *
 * Each entry is a pinned commit of a real repository plus a small authored
 * mutation. Nothing proprietary is committed to this repository: corpus.json
 * holds references and find/replace pairs, and the source only ever exists in
 * .corpus/, which is git-ignored.
 *
 * The source repository is never touched. `git archive <sha>` streams a frozen
 * tree out of the object database — no checkout, no worktree registration, no
 * working-tree mutation. That is deliberate: EVAL.md documents a run where a
 * live working tree changed underneath the measurement.
 *
 * node_modules is symlinked from the source repository rather than installed.
 * Caveat worth knowing: those are the dependencies as installed today, not as
 * they were at <sha>. For measuring diagnostic volume that is fine; for
 * anything claiming to reproduce a historical build it is not.
 *
 * **Public entries (2026-08-04).** An entry may name a `remote` git URL instead
 * of a local `repo`. It is mirrored once into .cache/corpus-repos/, blobless, no
 * checkout, and every later build reads that mirror — so the network is touched
 * once per entry and never during a measurement. This is what makes a wider
 * corpus possible without vendoring third-party source: hono alone is 707 kB of
 * TypeScript against the 40 kB the whole committed corpus weighs.
 *
 * Those three entries carry no runtime dependency and no `node_modules` at all;
 * `typescript` resolves upward out of .corpus/ into this repository's own, which
 * is the same compiler the fixtures are measured with.
 *
 * An entry may also `write` files after the archive is unpacked. Every one of
 * the public entries needs it: their real project files are solution tsconfigs
 * with `references` (`tsc -p .` there reports 0 errors over 0 files, the trap
 * EVAL.md records on data-explorer), or they extend a config that only exists
 * once dependencies are installed. The written file is always `tsconfig.json`
 * in the measured directory, overwriting the archived one, so that everything
 * downstream — this script, run.ts, the CLI — keeps pointing a plain directory
 * at a plain tsconfig.
 *
 * Usage:
 *   node scripts/build-corpus.mjs           # build every entry, verify each fails
 *   node scripts/build-corpus.mjs --clean   # remove .corpus/ and exit
 *   node scripts/build-corpus.mjs --offline # never touch the network; skip un-mirrored entries
 */

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const corpusRoot = join(repoRoot, ".corpus");
const manifest = JSON.parse(readFileSync(join(repoRoot, "eval", "corpus.json"), "utf8"));

if (process.argv.includes("--clean")) {
  rmSync(corpusRoot, { recursive: true, force: true });
  console.log("removed .corpus/");
  process.exit(0);
}

const expandHome = (path) => (path.startsWith("~/") ? join(homedir(), path.slice(2)) : path);

const offline = process.argv.includes("--offline");
const mirrorRoot = join(repoRoot, ".cache", "corpus-repos");

/**
 * A local mirror of a public repository, or `undefined` if it cannot be had.
 *
 * Blobless and checkout-less: the working tree is never materialised here, only
 * in .corpus/ via `git archive`, which is the same guarantee the local entries
 * already rely on. If the mirror exists but predates the pinned sha, one
 * targeted fetch is attempted rather than a full re-clone.
 */
function mirrorFor(entry) {
  const dir = join(mirrorRoot, entry.name.replace(/[^a-zA-Z0-9._-]/g, "_"));
  const hasCommit = () =>
    existsSync(dir) &&
    spawnSync("git", ["-C", dir, "cat-file", "-e", `${entry.sha}^{commit}`]).status === 0;

  if (hasCommit()) return dir;
  if (offline) {
    console.log(`SKIP  ${entry.name} — not mirrored and --offline was given`);
    return undefined;
  }

  if (!existsSync(dir)) {
    mkdirSync(mirrorRoot, { recursive: true });
    console.log(`clone ${entry.name} ← ${entry.remote}`);
    const clone = spawnSync(
      "git",
      ["clone", "--filter=blob:none", "--no-checkout", entry.remote, dir],
      { stdio: "inherit", timeout: 900000 },
    );
    if (clone.status !== 0) {
      rmSync(dir, { recursive: true, force: true });
      console.log(`FAIL  ${entry.name} — clone failed`);
      return undefined;
    }
  }

  if (!hasCommit()) {
    // A pinned sha that the default branch has moved past, or a force-push.
    spawnSync("git", ["-C", dir, "fetch", "--filter=blob:none", "origin", entry.sha], {
      stdio: "inherit",
      timeout: 900000,
    });
  }

  if (!hasCommit()) {
    console.log(`FAIL  ${entry.name} — commit ${entry.sha.slice(0, 12)} not reachable from remote`);
    return undefined;
  }
  return dir;
}

function tscFor(projectDir) {
  const require = createRequire(join(projectDir, "anchor.cjs"));
  return join(dirname(require.resolve("typescript")), "tsc.js");
}

let failed = 0;
mkdirSync(corpusRoot, { recursive: true });

// Prune directories left behind by entries that no longer exist in the
// manifest. Otherwise a removed entry keeps being measured, and keeps tripping
// tools that walk the tree.
const declared = new Set(manifest.entries.map((entry) => entry.name));
for (const name of readdirSync(corpusRoot)) {
  if (!declared.has(name)) {
    rmSync(join(corpusRoot, name), { recursive: true, force: true });
    console.log(`prune ${name} — no longer in eval/corpus.json`);
  }
}

for (const entry of manifest.entries) {
  const target = join(corpusRoot, entry.name);

  let source;
  if (entry.remote) {
    source = mirrorFor(entry);
    // A missing mirror under --offline is a skip, not a failure: the corpus is
    // still measurable from whatever is already on disk.
    if (!source) {
      if (!offline) failed += 1;
      continue;
    }
  } else {
    source = expandHome(entry.repo);
    if (!existsSync(source)) {
      console.log(`SKIP  ${entry.name} — source repository not found: ${source}`);
      continue;
    }
    const known = spawnSync("git", ["-C", source, "cat-file", "-e", `${entry.sha}^{commit}`]);
    if (known.status !== 0) {
      console.log(`FAIL  ${entry.name} — commit ${entry.sha.slice(0, 12)} not in ${source}`);
      failed += 1;
      continue;
    }
  }

  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });

  const archive = spawnSync("bash", [
    "-c",
    `git -C '${source}' archive ${entry.sha} | tar -x -C '${target}'`,
  ]);
  if (archive.status !== 0) {
    console.log(`FAIL  ${entry.name} — git archive failed`);
    failed += 1;
    continue;
  }

  if (!existsSync(join(target, "node_modules")) && existsSync(join(source, "node_modules"))) {
    symlinkSync(join(source, "node_modules"), join(target, "node_modules"));
  }

  // Written files land before the mutations so an entry could, in principle,
  // mutate one — and after the archive so it always wins over what was pinned.
  for (const file of entry.write ?? []) {
    const path = join(target, file.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(file.json, null, 2)}\n`);
  }

  // Apply the mutations. An anchor that is absent, or present more than once,
  // is an error: a corpus entry that silently mutates the wrong line is worse
  // than no corpus entry.
  let applied = true;
  for (const mutation of entry.mutations) {
    const file = join(target, mutation.file);
    if (!existsSync(file)) {
      console.log(`FAIL  ${entry.name} — missing ${mutation.file} at ${entry.sha.slice(0, 12)}`);
      applied = false;
      break;
    }
    const before = readFileSync(file, "utf8");
    const occurrences = before.split(mutation.find).length - 1;
    if (occurrences !== 1) {
      console.log(
        `FAIL  ${entry.name} — anchor found ${occurrences}x in ${mutation.file}, expected exactly 1`,
      );
      applied = false;
      break;
    }
    writeFileSync(file, before.replace(mutation.find, mutation.replace));
  }
  if (!applied) {
    failed += 1;
    continue;
  }

  const projectDir = resolve(target, entry.project ?? ".");
  const run = spawnSync(
    process.execPath,
    [
      tscFor(projectDir),
      "-p",
      "tsconfig.json",
      "--noEmit",
      "--pretty",
      "false",
      "--incremental",
      "false",
    ],
    { cwd: projectDir, encoding: "utf8", maxBuffer: 1 << 28, timeout: 600000 },
  );
  const output = `${run.stdout ?? ""}${run.stderr ?? ""}`;
  const diagnostics = (output.match(/^\S.*: (error|warning) TS\d+: /gm) ?? []).length;
  const files = new Set([...output.matchAll(/^(\S+?)\(\d+,\d+\)/gm)].map((m) => m[1])).size;
  const codes = [...new Set([...output.matchAll(/ (?:error|warning) (TS\d+):/g)].map((m) => m[1]))];

  if (diagnostics === 0) {
    console.log(`FAIL  ${entry.name} — mutation applied but the project still compiles clean`);
    failed += 1;
    continue;
  }

  console.log(
    `ok    ${entry.name.padEnd(30)} ${String(diagnostics).padStart(4)} diags in ${String(files).padStart(3)} files  ${codes.slice(0, 6).join(",")}`,
  );
}

if (failed > 0) {
  console.log(`\n${failed} corpus entr${failed === 1 ? "y" : "ies"} failed to build.`);
  process.exitCode = 1;
}
