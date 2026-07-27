import { describe, expect, it } from "vitest";

/**
 * Rule 11 made testable.
 *
 * bun is this repository's package manager, not its test runtime: Node is what
 * users run. `bun run test` respects vitest's `#!/usr/bin/env node` shebang and
 * delegates; `bun run --bun test` short-circuits it silently, which is exactly
 * the kind of failure that leaves no trace in a log.
 *
 * `process.version` cannot carry this check on its own — under bun it reports an
 * *emulated* Node version, and the CI matrix runs Node 20, 22 and 24 anyway. The
 * `Bun` global is the version-independent tell.
 */
describe("test runtime", () => {
  it("is Node, not bun", () => {
    expect("Bun" in globalThis).toBe(false);
    expect(process.versions.bun).toBeUndefined();
    expect(process.versions.node).toBeDefined();
  });

  it("meets the engines floor the package promises", () => {
    const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
    expect(major > 20 || (major === 20 && minor >= 19)).toBe(true);
  });
});
