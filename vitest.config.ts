import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // fixtures/ contient du code cassé exprès : la découverte ne doit jamais y entrer.
    exclude: ["fixtures/**", "dist/**", ".eval-dist/**", "node_modules/**"],
    // Snapshots en fichiers (__snapshots__/), jamais inline : un diff de snapshot
    // est le filet de sécurité du projet, il doit se lire.
    resolveSnapshotPath: (testPath, snapExtension) =>
      testPath.replace(/(\.test\.ts)$/, `$1${snapExtension}`),
  },
});
