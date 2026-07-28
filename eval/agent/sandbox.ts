/**
 * A per-run copy of a fixture's `before/`, isolated in a temp directory.
 *
 * The B1 model arm runs a real agent loop with a `write_file` tool, so it MUST
 * NOT touch the committed fixture — every run gets its own throwaway copy, and
 * the false-start metric is read from the paths written inside it. This mirrors
 * `scripts/build-corpus.mjs`, which also materialises into a scratch tree rather
 * than mutating a source.
 *
 * `typescript` is symlinked into the copy so the shipped code path
 * (`TsApiSource` → `createRequire(<root>)` → `require.resolve("typescript")`)
 * resolves the same compiler the fixtures are verified under — without it, a
 * canonical fixture (no committed `node_modules`) would make tssift refuse with
 * "cannot resolve typescript", which is not what we are measuring.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export interface Sandbox {
  /** Absolute path to the throwaway copy of `before/`. */
  dir: string;
  /** Remove the copy. Always call in a `finally`. */
  cleanup(): void;
}

/**
 * Copy `beforeDir` into a fresh temp directory and make `typescript` resolvable
 * from its root. `repoTypescriptDir` is the repo's own `typescript` package dir
 * (`dirname(dirname(require.resolve("typescript")))` in the caller).
 */
export function makeSandbox(beforeDir: string, repoTypescriptDir: string): Sandbox {
  const dir = mkdtempSync(join(tmpdir(), "tssift-agent-"));
  cpSync(beforeDir, dir, { recursive: true });

  // Add `typescript` without clobbering a fixture's own committed node_modules
  // (pnpm / PnP fixtures ship one; canonical fixtures do not). typescript is
  // dependency-free, so a single symlink is enough for require.resolve.
  const modules = join(dir, "node_modules");
  mkdirSync(modules, { recursive: true });
  const target = join(modules, "typescript");
  if (!existsSync(target)) {
    mkdirSync(dirname(target), { recursive: true });
    symlinkSync(repoTypescriptDir, target, "dir");
  }

  return {
    dir,
    cleanup() {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
