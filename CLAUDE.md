# CLAUDE.md

Les instructions de travail de ce dépôt sont dans **AGENTS.md** — un seul fichier fait autorité, pour éviter la dérive entre deux copies.

@AGENTS.md

Ce qui suit ne concerne que l'usage de Claude Code sur ce projet.

---

## Ordre de lecture en début de session

1. `AGENTS.md` (importé ci-dessus) — les règles dures
2. `PROJECT.md` — la spec produit, seule source de vérité pour le modèle de données (§4) et la table des enrichisseurs (§5.2)
3. `.plans/2026-07-27_p1-causality.md` — le plan courant : le séquencement exécutable de P1, avec critères d'acceptation. (`_p0-b0.md` est clos, `_prior-art.md` porte le verdict du créneau)
4. `EVAL.md` s'il existe — les chiffres priment sur les intentions

**P0 + B0 sont livrés** (2026-07-27). Le code existe : `src/` (types, codes, `sources/ts-api.ts`, `render/`, `run.ts`, `cli.ts`), `test/` (70 tests, 3 snapshots), `eval/`, `fixtures/`, `.github/workflows/`. En revanche **`src/pipeline/` n'existe pas du tout** — causalité, regroupement et enrichissement sont P1/P2.

En revanche, **le contrat de sortie et le modèle de données sont arrêtés** depuis le 2026-07-27 et vivent dans PROJECT.md. Deux faits qu'il ne faut pas redécouvrir à chaque session :

- `typescript@7.0.2` est le `latest` npm et n'a plus `ts.createProgram`. V1 vise 5.4 → 5.9 et refuse 6/7 en **sortie 2**.
- Le renderer sort en **anglais** et n'altère **jamais** le message TS. L'exemple de §6 a été corrigé en ce sens : une version antérieure montrait une reformulation, qui était H2 glissée dans P0.

## Quand demander plutôt que décider

Ce projet a une spec inhabituellement précise et une liste explicite de non-objectifs. La bonne posture est donc étroite : **exécuter la spec, signaler les écarts, ne pas élargir**.

Demander avant d'agir si la tâche implique :
- de trancher une des « Décisions ouvertes » d'AGENTS.md
- d'ajouter un code d'erreur **hors** de la table des 10 de PROJECT.md §5.2
- de commencer le **serveur MCP** ou toute distribution (bloqués par la porte de décision §7)
- d'ajouter une dépendance runtime
- d'écrire quoi que ce soit qui **prescrit un correctif** (règle 1)

Sont **tranchés**, ne pas les rouvrir : le paquet s'appelle `tssift`, bun est le gestionnaire de paquets de dev, les tests tournent sous Node, la plage TS est 5.4 → 5.9, le build est `tsc` sans bundler, la sortie est en anglais avec le message TS brut, la causalité ne dérive que sur liens structurels, B0 ne fait appel à aucun modèle. La liste complète et ses raisons : AGENTS.md § « Décisions ouvertes » et PROJECT.md.

Dans les autres cas : agir, et rapporter ce qui a été fait.

## Plan mode

Le contrat de sortie est désormais **arrêté** (PROJECT.md §6) : il ne relève plus du plan mode, il s'applique.

Reste une seule chose pour laquelle le plan mode vaut le détour : la **détection de causalité** (`pipeline/causality.ts`) — composant à plus forte valeur, le plus facile à rendre faux, et le seuil de preuve de §5.1 est à respecter à la lettre. La condition posée — « à concevoir après l'existence des premiers snapshots » — est **remplie** depuis le 2026-07-27 : `test/__snapshots__/render.test.ts.snap` existe, et `ProgramFacts.imports` porte les spécificateurs tels qu'écrits, ce dont la règle 2307 de §5.1 a besoin. C'est donc la prochaine chose à concevoir, en plan mode.

Le reste est mécanique et se fait directement, en suivant le plan de `.plans/`.

## Git

Le dépôt est **initialisé sur `main`** depuis le 2026-07-27, sans remote.

Ensuite : **commit à chaque jalon terminé, sans demander** ; un diff de snapshot ne se lit que contre une base. **Ne jamais pousser sans demande explicite** — et `gh` n'est pas installé, la création du dépôt distant revient à l'humain.

## Vérification

Après toute modification :

```bash
mise exec -- bun run typecheck && mise exec -- bun run test && mise exec -- bun run check
```

(scripts à créer en P0). Les snapshots sont le filet de sécurité du projet : un diff de snapshot se **lit**, il ne se régénère pas en aveugle.

Toujours préfixer par `mise exec --`. Le shell des outils n'a pas nécessairement mise activé, et il traîne sur cette machine un bun hors mise (`~/.bun`) plus un Node système : les viser donnerait une version différente de celle épinglée, sans aucun message d'erreur. Si une commande échoue en `command not found`, la réponse est `mise install`, jamais un chemin absolu ni un repli sur npm.

## Honnêteté des résultats

Ce projet existe pour produire des chiffres, dont certains infirmeront peut-être H2. Rapporter la mesure obtenue, pas la mesure espérée. Un « H2 ne donne rien sur ce code » est un livrable, pas un échec.
