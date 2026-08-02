# CLAUDE.md

Les instructions de travail de ce dépôt sont dans **AGENTS.md** — un seul fichier fait autorité, pour éviter la dérive entre deux copies.

@AGENTS.md

Ce qui suit ne concerne que l'usage de Claude Code sur ce projet.

---

## Ordre de lecture en début de session

1. `AGENTS.md` (importé ci-dessus) — les règles dures
2. `PROJECT.md` — la spec produit, seule source de vérité pour le modèle de données (§4) et la table des enrichisseurs (§5.2)
3. `.plans/2026-08-01_p2-enrichment.md` — **le plan courant** : la première tranche de P2, ce que chaque mesure a décidé, et les quatre codes de §5.2 qui restent avec ce qui les débloquerait. Les autres sont **clos** : `_b1.md`, `_0.0.1-release-prep.md`, `_p0-b0.md`, `_p1-causality.md` (son tableau d'avancement dit où le plan s'est trompé), `_prior-art.md` (le verdict du créneau).
4. `EVAL.md` — les chiffres priment sur les intentions

**P0, B0 et P1 sont livrés** (2026-07-27). `src/pipeline/` **existe et est complet** — dedupe, causalité, regroupement, budget ; `pipeline/enrich/` est ouvert depuis le 2026-08-01 (six codes, première tranche de P2). Depuis le 2026-07-28 le corpus de fixtures est à **20** — la cible de §8 lot B, atteinte par T0 de B1 — et la suite passe à **518 tests**. Détail à jour dans AGENTS.md § « État actuel » — ce paragraphe-ci n'en est qu'un raccourci et c'est l'autre qui fait foi.

En revanche, **le contrat de sortie et le modèle de données sont arrêtés** depuis le 2026-07-27 et vivent dans PROJECT.md. Deux faits qu'il ne faut pas redécouvrir à chaque session :

- `typescript@7.0.2` est le `latest` npm et n'a plus `ts.createProgram`. V1 vise 5.4 → 5.9 et refuse 6/7 en **sortie 2**.
- Le renderer sort en **anglais** et n'altère **jamais** le message TS. L'exemple de §6 a été corrigé en ce sens : une version antérieure montrait une reformulation, qui était H2 glissée dans P0.

## Quand demander plutôt que décider

Ce projet a une spec inhabituellement précise et une liste explicite de non-objectifs. La bonne posture est donc étroite : **exécuter la spec, signaler les écarts, ne pas élargir**.

Demander avant d'agir si la tâche implique :
- de trancher une des « Décisions ouvertes » d'AGENTS.md
- d'ajouter un code d'erreur **hors** de la table des 10 de PROJECT.md §5.2
- de commencer le **serveur MCP** ou toute distribution — la porte §7 s'est ouverte le 2026-08-01 **vers P2 seulement** ; le MCP et la publication npm restent un choix humain non fait
- de **rouvrir 2551 ou 2769** : P2 les a écartés sur mesure, pas par manque de temps (AGENTS.md § État actuel)
- d'ajouter une dépendance runtime
- d'écrire quoi que ce soit qui **prescrit un correctif** (règle 1)

Sont **tranchés**, ne pas les rouvrir : le paquet s'appelle `tssift`, bun est le gestionnaire de paquets de dev, les tests tournent sous Node, la plage TS est 5.4 → 5.9, le build est `tsc` sans bundler, la sortie est en anglais avec le message TS brut, la causalité ne dérive que sur liens structurels, B0 ne fait appel à aucun modèle. La liste complète et ses raisons : AGENTS.md § « Décisions ouvertes » et PROJECT.md.

Dans les autres cas : agir, et rapporter ce qui a été fait.

## Plan mode

Le contrat de sortie est désormais **arrêté** (PROJECT.md §6) : il ne relève plus du plan mode, il s'applique.

La **détection de causalité** (`pipeline/causality.ts`) reste la chose pour laquelle le plan mode vaut le détour — composant à plus forte valeur, le plus facile à rendre faux, et le seuil de preuve de §5.1 est à respecter à la lettre. Son premier jet est livré (P1), mais la consigne vaut pour **toute règle de dérivation ajoutée après coup**, pas seulement pour la première.

Concrètement, la prochaine à concevoir en plan mode est la **règle 2307** de §5.1, laissée non écrite en P1. Son blocage est levé depuis le 2026-07-28 : `ProgramFacts.imports` porte bien les spécificateurs tels qu'écrits, résolus ou non (le contraire, écrit dans §5.1 et dans `src/types.ts`, était faux et a été corrigé), et trois fixtures la testent enfin — `wrong-tsconfig-paths`, `phantom-dependency-pnpm`, `yarn-pnp-project`. Lire ce qu'elles ont appris (PROJECT.md §5.1, `EVAL.md`) **avant** de dessiner la règle : la clé est le spécificateur et non le fichier, et regrouper tous les 2307 d'un projet serait un sur-regroupement.

Le reste est mécanique et se fait directement.

## Git

Le dépôt est **initialisé sur `main`** depuis le 2026-07-27, et poussé depuis le 2026-07-28 sur un GitLab auto-hébergé (`origin`, voir AGENTS.md § Git). Conséquence à connaître : **la CI de `.github/workflows/` n'y tourne pas**, faute de miroir GitHub.

Ensuite : **commit à chaque jalon terminé, sans demander** ; un diff de snapshot ne se lit que contre une base. **Ne jamais pousser sans demande explicite** — et `gh` est inutile ici comme absent : le remote est sur GitLab.

## Vérification

Après toute modification :

```bash
mise exec -- bun run typecheck && mise exec -- bun run test && mise exec -- bun run check
```

Les scripts existent depuis P0 ; `mise exec -- bun run fixtures:verify` s'y ajoute dès qu'une fixture est touchée — il vérifie que chaque `before/` échoue réellement sous **5.4.5 et 5.9.3**. Les snapshots sont le filet de sécurité du projet : un diff de snapshot se **lit**, il ne se régénère pas en aveugle.

Toujours préfixer par `mise exec --`. Le shell des outils n'a pas nécessairement mise activé, et il traîne sur cette machine un bun hors mise (`~/.bun`) plus un Node système : les viser donnerait une version différente de celle épinglée, sans aucun message d'erreur. Si une commande échoue en `command not found`, la réponse est `mise install`, jamais un chemin absolu ni un repli sur npm.

## Honnêteté des résultats

Ce projet existe pour produire des chiffres, dont certains infirmeront peut-être H2. Rapporter la mesure obtenue, pas la mesure espérée. Un « H2 ne donne rien sur ce code » est un livrable, pas un échec.
