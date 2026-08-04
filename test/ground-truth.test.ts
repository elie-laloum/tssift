/**
 * Guards on the eval ground truth — the `meta.json` fields the model arm scores
 * against. They are prose plus two path lists, so nothing but a test keeps them
 * honest: a path that no longer exists, or a file counted in two categories at
 * once, silently changes what the false-start rate means.
 *
 * The `consumerFiles` half exists because B1 measured a contradiction. Two
 * corpus entries state in their own `expectedFix` that patching every consumer
 * settles the cascade, and were then scored 100 % false start for doing exactly
 * that — `rootCauseFiles` held the declaration alone. See eval/agent/metrics.ts
 * and EVAL.md § B2 §3.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

interface GroundTruth {
  rootCauseFiles?: unknown;
  consumerFiles?: unknown;
  expectedFix?: unknown;
}

function targetsIn(kind: "fixtures" | "corpus"): Array<{ name: string; dir: string }> {
  const root = join(repoRoot, kind);
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((name) => existsSync(join(root, name, "before", "tsconfig.json")))
    .sort()
    .map((name) => ({ name: `${kind}/${name}`, dir: join(root, name) }));
}

function metaOf(dir: string): GroundTruth {
  return JSON.parse(readFileSync(join(dir, "meta.json"), "utf8")) as GroundTruth;
}

const allTargets = [...targetsIn("fixtures"), ...targetsIn("corpus")];

describe("eval ground truth", () => {
  it("finds targets at all — a silent empty sweep would pass every other check", () => {
    expect(allTargets.length).toBeGreaterThanOrEqual(22);
  });

  for (const target of allTargets) {
    describe(target.name, () => {
      const meta = metaOf(target.dir);

      it("declares rootCauseFiles as an array", () => {
        // An empty array is meaningful: yarn-pnp-project's `before/` has no bug,
        // so every write is a false start. Only absence is the error.
        expect(Array.isArray(meta.rootCauseFiles)).toBe(true);
      });

      it("names only paths that exist, or that expectedFix says to create", () => {
        // Not every root-cause path exists in `before/`: `cannot-find-name` and
        // `two-missing-names-one-file` both name `src/money.ts`, the deleted
        // module whose *reintroduction* is the fix, and `write_file` creates as
        // readily as it overwrites. So the check is existence OR a mention in
        // the fixture's own prose — which is what makes a typo still fail.
        const fix = String(meta.expectedFix ?? "");
        const declared = [
          ...(meta.rootCauseFiles as string[]),
          ...((meta.consumerFiles as string[] | undefined) ?? []),
        ];
        const unaccounted = declared.filter(
          (p) => !existsSync(join(target.dir, "before", p)) && !fix.includes(p),
        );
        expect(unaccounted).toEqual([]);
      });

      it("names only existing files as consumer-route sites", () => {
        // A consumer route patches call sites that already read the renamed
        // thing; there is no such thing as creating one.
        const consumers = (meta.consumerFiles as string[] | undefined) ?? [];
        const missing = consumers.filter((p) => !existsSync(join(target.dir, "before", p)));
        expect(missing).toEqual([]);
      });

      it("keeps the cause and the consumer route disjoint", () => {
        // A path in both would be scored as a fix site and as the wide route at
        // once, which is not a category — it is a bug in the ground truth.
        const causes = new Set(meta.rootCauseFiles as string[]);
        const overlap = ((meta.consumerFiles as string[] | undefined) ?? []).filter((p) =>
          causes.has(p),
        );
        expect(overlap).toEqual([]);
      });
    });
  }
});

describe("the two entries whose expectedFix admits a wide route declare it", () => {
  // Named rather than derived: this is the 2026-08-04 repair, and the point of
  // pinning it is that dropping consumerFiles from either entry silently
  // restores the defect B2 recorded rather than failing loudly.
  for (const name of ["order-book-field-renamed", "shape-tag-renamed"]) {
    it(`corpus/${name}`, () => {
      const meta = metaOf(join(repoRoot, "corpus", name));
      expect(Array.isArray(meta.consumerFiles)).toBe(true);
      expect((meta.consumerFiles as string[]).length).toBeGreaterThan(10);
    });
  }
});

describe("no fixture calls a compiling alternative a false start in prose", () => {
  // The defect was a wording pattern before it was a scoring bug: an
  // expectedFix that concedes a second route settles the cascade, and then
  // calls that route a false start. If a future entry says both, it must carry
  // consumerFiles too.
  for (const target of allTargets) {
    it(target.name, () => {
      const fix = String(metaOf(target.dir).expectedFix ?? "");
      const admitsWideRoute = /\b(also compiles|both settle|or equivalently)\b/i.test(fix);
      const callsItFalseStart = /\bfalse start\b/i.test(fix);
      if (admitsWideRoute && callsItFalseStart) {
        expect(Array.isArray(metaOf(target.dir).consumerFiles)).toBe(true);
      }
    });
  }
});
