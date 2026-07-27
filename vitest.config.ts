import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // fixtures/ contient du code cassé exprès : la découverte ne doit jamais y entrer.
    exclude: ["fixtures/**", "dist/**", ".eval-dist/**", "node_modules/**"],
    // Snapshots en fichiers (test/__snapshots__/), jamais inline : un diff de
    // snapshot est le filet de sécurité du projet, il doit se lire. C'est le
    // défaut de vitest — on ne le surcharge pas, on le documente.
  },
});
