import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // fixtures/ contient du code cassé exprès : la découverte ne doit jamais y entrer.
    exclude: ["fixtures/**", "dist/**", ".eval-dist/**", ".corpus/**", "node_modules/**"],
    // Snapshots en fichiers (test/__snapshots__/), jamais inline : un diff de
    // snapshot est le filet de sécurité du projet, il doit se lire. C'est le
    // défaut de vitest — on ne le surcharge pas, on le documente.
    //
    // Le défaut de 5 s est trop court ici et rendait la suite intermittente : un
    // test de fixture instancie un programme TypeScript complet — deux fois pour
    // les fichiers qui balaient 5.4.5 et 5.9.3 — et mesure 5 à 7 s sur du gros
    // (yarn-pnp-project, two-roots-one-file). Constaté le 2026-08-05 : deux
    // invocations identiques, l'une verte et l'autre avec sept timeouts, sur des
    // tests différents à chaque fois et sans une seule assertion en échec.
    // 30 s laisse la marge sans masquer un vrai blocage — le plus lent observé
    // reste sous 8 s, donc un test qui atteint ce plafond est en panne, pas lent.
    testTimeout: 30_000,
  },
});
