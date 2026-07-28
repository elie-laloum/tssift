# AGENTS.md

Instructions de travail pour tout agent intervenant sur ce dépôt.
La spec produit complète est dans **[PROJECT.md](./PROJECT.md)** — ce fichier ne la remplace pas, il dit **comment travailler dessus**.

---

## Le projet en cinq lignes

Couche de post-traitement des diagnostics `tsc`, destinée à un **agent** qui lance `tsc --noEmit` dans un shell et non à un humain dans un éditeur. On regroupe les diagnostics par cause racine, on les trie par pouvoir explicatif, on attache les faits que l'éditeur donnerait gratuitement (où le type est déclaré, ses membres réels, quelle surcharge a échoué).

**On ne dit jamais quoi corriger. On dit ce qui est vrai.**

Deux hypothèses d'inégale solidité — voir PROJECT.md §1 :
- **H1** (confiance forte) : réduire le bruit en cascade réduit les faux départs et les tokens.
- **H2** (confiance faible) : reformuler le message améliore le taux de correction.

H1 se construit d'abord. H2 ne se construit **que** sur les codes où l'éval montre un gain.

---

## État actuel

**P0 + B0 livrés le 2026-07-27. P1 est livrée en entier le même jour — T0 → T7.** Le dépôt est initialisé sur `main`, la chaîne d'outils est en place, et `mise exec -- bun run typecheck && … test && … check` passe (**452 tests**). Depuis le 2026-07-28, le corpus de fixtures est passé de 4 à **20** — la cible de §8 lot B est atteinte (**T0 de B1**). Un lot intermédiaire a dévié du tsconfig canonique pour épuiser les catégories de **configuration** de §7, dont deux fixtures portent une **arborescence installée commitée** (liens `.pnpm`, projet PnP sans `node_modules`) demandant les exceptions `!fixtures/**/…` du `.gitignore` ; le dernier lot (T0) ajoute la dernière catégorie de §7, `missing-type-import`, deux cascades témoins et un second témoin négatif.

Ce qui existe : les **16** fixtures de contrat · `src/types.ts` + `src/codes.ts` · `TsApiSource` avec **capture sélective de contexte** (`sources/context.ts`, codes 2305 · 2339 · 2345 · 2353 · 2554 · 2724) · `src/pipeline/` complet — **dedupe, causalité, regroupement, budget** · renderers `json` et `agent-text` · CLI avec sorties 0/1/2 et `--all` / `--budget-tokens` · `eval/measure.ts` et `EVAL.md` · la CI trois axes + garde TS 7.

Ce qui n'existe pas encore : tout l'**enrichissement** (P2, `src/pipeline/enrich/` est vide), et **B1** — le bras d'éval qui appelle un modèle.

**H1 est confirmée sur du vrai code, et le chiffre est dans `EVAL.md`.** Ligne de base P0 : 283 diagnostics des deux côtés, sortie à **141 %** de `tsc` brut. Après P1 : **283 diagnostics rendus en 29 entrées (pliage de 90 %), sortie à 20 %** — soit sept fois moins de caractères que la ligne de base. Sur les trois entrées de corpus, qui sont les seules cibles réalistes, le rapport tombe à **6 – 42 %** ; `lekes-ok-arity-changed` rend 153 diagnostics en **2 entrées**. *(La quatrième fixture est entrée dans la mesure après coup : le total publié devient 286 → 30 et 22 %, et à périmètre constant les chiffres ci-dessus sont inchangés.)*

Deux chiffres à ne pas mélire :
- **Le témoin négatif `two-independent-roots` reste à 2 entrées pour 2 diagnostics, pliage 0 %.** C'est le comportement voulu et un critère de la DoD.
- **Les petites fixtures coûtent plus cher qu'avant** (`partial-interface-rename` : 133 % → 159 %). Sous le plafond de trois sites, tous les diagnostics s'impriment encore et l'en-tête de cause s'ajoute par-dessus. Le gain y est structurel, pas volumétrique — et sur un projet de trois erreurs, `tsc` n'a pas de problème de bruit.

**Le contrat de sortie et le modèle de données ont été arrêtés le 2026-07-27** et sont intégrés dans PROJECT.md. Ils ne se rouvrent pas sans raison neuve. Le séquencement exécutable, avec critères d'acceptation, est dans **`.plans/2026-07-27_p0-b0.md`**.

Un fait de contexte à ne pas redécouvrir : **`typescript@7.0.2` est le `latest` du registre npm** et n'expose plus `ts.createProgram`. V1 vise 5.4 → 5.9 et **refuse** 6/7 en sortie 2 ; `Ts7ApiSource` est un jalon daté (PROJECT.md §8, P2.5). Détail complet en §3.

La porte d'arrêt du créneau a été franchie : `.plans/2026-07-27_prior-art.md`. **Verdict à connaître avant d'ouvrir P1** — le positionnement « consommateur = agent » n'est plus libre (trois serveurs MCP depuis fin 2025), mais aucun ne hiérarchise. Ce qui reste au projet se confond donc avec P1. Un `tssift` qui s'arrêterait à P0 n'aurait pas de créneau.

**Les vingt fixtures et ce que chacune est seule à couvrir.**

| fixture | codes | plie | ce qu'elle est seule à porter |
|---|---|---|---|
| `partial-interface-rename` | 2353 · 2339 · 2345 | 3 → 1 | l'exemple de §6 ; trois codes sur une déclaration |
| `two-independent-roots` | 2307 · 2339 | **0 %** | le témoin négatif de la DoD (§12) ; deux racines, deux fichiers, deux codes |
| `overload-mismatch` | 2769 | — | chaîne à trois niveaux, trois `related` |
| `broken-barrel-export` | 2724 | 3 → 1 | cause = **module** ; trois fichiers sur un symbole |
| `arity-changed` | 2554 | 4 → 1 | le jumeau **commité** de la plus grosse cascade de l'éval ; seule à dépasser le plafond d'affichage |
| `narrowed-union-member` | 2339 | 8 → 1 | cause = **alias d'union** ; seule cascade **de second ordre** |
| `nullable-chain` | 18047 | **0 %** | cascade réelle que le seuil refuse — rien n'est capturé |
| `missing-required-property` | 2741 | **0 %** | un `related` qui **désigne bien** la cause, et reste inutilisé |
| `missing-multiple-properties` | 2739 | **0 %** | le jumeau **multi-membres** de 2741 ; le témoin qui manquait à 2739 |
| `assignability-mismatch` | 2322 | **0 %** | un `related` qui **désigne la mauvaise ligne** — la réfutation de la règle « related » |
| `misspelled-property` | 2551 | **0 %** | le garde du « ne pas dégrader » : la suggestion native est épinglée au snapshot |
| `unconstrained-generic` | 2536 · 2322 | **0 %** | la seule où les diagnostics sont **sur** leur propre cause |
| `value-used-as-type` | 2749 | **0 %** | **aucun** lien structurel d'aucune sorte — le bord extérieur du seuil |
| `missing-type-import` | 1484 | **0 %** | la dernière catégorie de §7 ; un **type importé comme valeur** (`verbatimModuleSyntax`) |
| `cannot-find-name` | 2304 | **0 %** | la **seconde moitié** de la liste de racines de §5.1 ; une cascade d'un seul nom manquant |
| `wrong-tsconfig-paths` | 2307 | **0 %** | cause = une ligne de **`tsconfig.json`**, donc dans aucun fichier du programme |
| `monorepo-cross-package` | 2339 | 4 → 1 | cause dans un **autre paquet** ; le garde-fou « hors programme » doit ici *admettre* |
| `phantom-dependency-pnpm` | 2307 | **0 %** | topologie **pnpm** commitée ; même message TS pour une vérité propre à l'installateur |
| `yarn-pnp-project` | 2307 | **0 %** | le seul `before/` **sans bug** : du code juste, mal lu, faute du runtime PnP |
| `two-roots-one-file` | 2339 | 4 → **2** | le témoin négatif **dur** : deux racines, **un fichier, un code** — deux groupes, pas un |

**Le chiffre à connaître : sur les dix-sept fixtures qui sont des cascades à cause unique, le seuil en plie cinq.** Les douze autres sortent entre 117 % et 225 %, c'est-à-dire au surcoût de P0. Le pliage ne tient donc pas à une propriété générale des cascades TypeScript mais à **la liste de six codes de `src/codes.ts`**. Elles sont commitées pour rendre ce manque **mesurable** plutôt qu'anecdotique, pas pour être corrigées tout de suite : plusieurs des codes manquants sont dans la table des dix de §5.2 et attendent les chiffres (règle 8). *(Les trois exclues du dénombrement : `overload-mismatch`, un seul diagnostic, et les deux témoins négatifs à plusieurs racines, `two-independent-roots` et `two-roots-one-file`.)*

**Le rapport a baissé de 4/10 à 5/14 puis à 5/17 sur la journée, et c'est de la composition, pas une régression** : chaque lot entrant visait des catégories que le seuil ne plie pas — configuration (dont trois TS2307), puis la dernière catégorie de §7 et deux cascades témoins. Aucune ligne de code moteur n'a bougé entre les mesures ; les cinq pliages sont identiques au caractère près.

**2307 est maintenant le code le plus témoigné parmi ceux qui ne plient pas — et le seul dont la règle est déjà écrite.** §5.1 la spécifie depuis le premier jour, elle ne demande aucun code de capture supplémentaire, et le motif « le modèle n'a pas encore le spécificateur non résolu » était **faux** : `ProgramFacts.imports` porte tous les spécificateurs tels qu'écrits, résolus ou non (vérifié le 2026-07-28 ; le commentaire de `src/types.ts` disait le contraire, corrigé). Le vrai blocage était l'absence de fixture, et il est levé. Ce que les trois fixtures apprennent sur la forme de la règle est dans PROJECT.md §5.1 et `EVAL.md` — en résumé : la cascade est *de* 2307 et non *depuis* un 2307, la clé est le **spécificateur** et jamais le fichier, et regrouper tous les 2307 d'un projet serait un sur-regroupement.

Jalon en cours : **B1**, plan d'exécution `.plans/2026-07-28_b1.md`, avec critères d'acceptation et ce qui demande un feu vert humain. Ce qu'il reste, dans l'ordre où ça se tient :

1. ~~**Quatre fixtures** pour atteindre les vingt de §8~~ — **T0 livré le 2026-07-28.** La dernière catégorie de §7 (`missing-type-import`, TS1484) est couverte ; toutes les catégories de §7 le sont désormais. Les trois créneaux libres ont pris `cannot-find-name` (TS2304, la seconde moitié de la liste de racines de §5.1), `missing-multiple-properties` (TS2739) et `two-roots-one-file` (le témoin négatif dur).
2. **La règle 2307 de §5.1**, désormais débloquée et testable ; à concevoir en plan mode, comme toute règle de dérivation. **C'est le prochain travail.**
3. **Un corpus réel figé plus large** — `EVAL.md` § « Limites du corpus » explique pourquoi celui d'aujourd'hui ne suffit pas : trois mutations d'un seul dépôt.
4. **Le harnais d'agent**, qui demande une clé d'API et donc un feu vert explicite.

C'est la porte de décision de PROJECT.md §7 : **P2 (enrichissement) et le serveur MCP restent fermés tant que B1 n'a pas parlé** (règle 8).

`.plans/2026-07-27_p1-causality.md` est clos, comme `_p0-b0.md` et `_prior-art.md` ; leurs tableaux d'avancement portent ce que chaque tâche a réellement donné, y compris là où le plan s'est trompé.

**Six faits établis en P1 et confirmés depuis, qu'il ne faut pas redécouvrir :**
- **Une cause n'est presque jamais un diagnostic.** Dans 100 % des groupes mesurés, aucun membre ne se trouve sur sa propre cause — renommer un champ laisse la déclaration valide et casse ses *usages*. D'où un groupe dont l'en-tête est une **déclaration** (`DiagnosticGroup`, PROJECT.md §4 et §6).
- **Une déclaration hors des fichiers du programme ne peut pas être une cause.** Un TS2345 du corpus résout vers `<ts-lib>/…/interface Map` ; grouper là-dessus fusionnerait deux bugs indépendants. Garde-fou en place, testé.
- **Le pipeline ne filtre jamais le tableau.** Il rend `{ diagnostics, groups }` où `diagnostics` est complet et `groups` n'est qu'un index de rendu. C'est ce qui rend la règle 2 vraie par construction.
- **Le code TS qui sort dépend parfois des noms, pas de la panne.** `broken-barrel-export` émet **2724** et jamais 2305, uniquement parce que `Order` voisine `OrderId` et que TypeScript préfère alors la variante « Did you mean ». Les deux codes partagent resolver et forme capturée ; les deux sont dans `CONTEXT_CAPTURE_CODES`. La leçon générale : **avant d'ajouter un code à une table, vérifier sur une fixture réelle lequel sort vraiment.**
- **Le span d'un `related` ne peut PAS servir de clé de regroupement — c'est tranché, par contre-exemple.** Sur `assignability-mismatch`, deux diagnostics sur trois portent un `related` qui désigne la *propriété* `Rate.currency`, du code parfaitement correct, alors que la cause est l'union `Currency` qui a perdu un membre trois lignes plus haut ; le troisième n'a aucun `related`. Une règle indexée là-dessus regrouperait deux tiers de la cascade en tête d'une ligne qui n'a pas besoin d'être modifiée. **Un `related` pointe là où le compilateur a jugé utile d'expliquer *ce* diagnostic, pas la cause.** Test nommé dans `test/causality.test.ts`.
- **Un barrel cassé n'est pas un TS2307.** Son module résout parfaitement — c'est le membre qui manque. La règle de dérivation 2307, longtemps rattachée à cette fixture, appartient donc à l'enrichisseur 2307 de P2 et à ses deux fixtures d'installateur (dépendance fantôme pnpm, Yarn PnP).

---

## Règles dures

Elles ne se négocient pas au cas par cas. Si une tâche semble en exiger la violation, **s'arrêter et le signaler** plutôt que de contourner.

| # | Règle | Pourquoi |
|---|---|---|
| 1 | **Aucune prescription.** Jamais « va dans le fichier C et ajoute X ». Aucun impératif dans un `Fact.text`. | Un outil déterministe qui affirme un fix erroné est pire qu'un message vague : le modèle le suivra sans le questionner. PROJECT.md §2. |
| 2 | **Ne jamais supprimer un diagnostic, seulement le déclasser.** `--all` restitue toujours l'intégralité. | Risque critique : un faux positif de causalité masquerait une vraie erreur. PROJECT.md §11. |
| 3 | **`NormalizedDiagnostic.message` reste le message TS brut, intact.** | Traçabilité. On peut toujours remonter à la sortie native. |
| 4 | **Le pipeline ne voit jamais le `TypeChecker`.** Tout est capturé à l'ingestion, sur deux canaux : `NormalizedDiagnostic.context` (par diagnostic, capture **sélective** pilotée par une liste de codes) et `ProgramFacts` (par programme : graphe de modules, fichiers). Les étages deviennent `(diagnostics, facts) => diagnostics`. Une poignée encapsulant le checker, même en lecture seule, viole la règle. | Le port Go (TS7) a supprimé `ts.createProgram`. Ce n'est plus une précaution : c'est la condition pour que `Ts7ApiSource` s'ajoute au lieu d'imposer une réécriture. |
| 5 | **`confidence: 'low'` ⇒ on rend le format natif.** Dégrader vaut mieux qu'inventer. | Idem règle 1. |
| 6 | **Ne jamais tronquer une racine** sous contrainte de budget. | Elle est la seule chose que l'agent doit lire en premier. |
| 7 | **`typescript` en `peerDependency` `>=5.4 <6`, jamais bundlé, et résolu depuis le projet analysé** (`createRequire(<projectRoot>/)`), jamais depuis notre propre installation. | Matrice de compat TS 5.4 → 5.9. Sous `npx`, npm ≥ 7 installe volontiers *sa* copie du peer : typechecker avec un autre compilateur que le `tsc` de l'utilisateur produirait des diagnostics que son outil de référence ne produit pas. |
| 8 | **Aucun travail sur le serveur MCP ni sur des codes supplémentaires avant les chiffres de l'éval.** | Porte de décision, PROJECT.md §7. |
| 9 | **Pas de `--fix`, pas de codefix, pas de réimplémentation de `tsc`.** | Non-objectifs, PROJECT.md §2. |
| 10 | **Ne jamais présumer qu'un dossier `node_modules/` existe. Ne jamais invoquer un gestionnaire de paquets en sous-processus.** On lit des fichiers déclaratifs. | Yarn PnP n'a pas de `node_modules` du tout, pnpm a une topologie strictement différente. PROJECT.md §9.1. |
| 11 | **Les tests tournent sous Node, jamais sous `bun test` ni `bun run --bun`.** bun est le gestionnaire de paquets, pas le runtime cible. | Node ≥ 20.19 est le runtime des utilisateurs. Vérifié le 2026-07-27 : `bun run` respecte le shebang `#!/usr/bin/env node` et délègue à Node ; `--bun` le court-circuite silencieusement. |
| 12 | **En local, toute commande passe par `mise exec -- …`. Aucun binaire appelé par chemin absolu** (`~/.bun/bin/bun`, `/usr/bin/node`…). | Le shell d'un agent n'a pas forcément mise activé. Un chemin en dur contourne la version épinglée sans bruit — et il existe un bun hors mise sur cette machine, donc le piège est réel. Ne s'applique pas à la CI, qui n'utilise pas mise. |
| 13 | **La sortie du renderer est en anglais, cadre compris, et le message TS y est brut et verbatim.** Pas de reformulation avant que l'éval ne la justifie, code par code, via `restated`. | Un cadre français autour d'un message anglais donne un rapport bilingue (règle 3 interdit de traduire). Et le bras B ne doit différer du bras A **que** par la structure, sinon H1 devient immesurable. PROJECT.md §6. |
| 14 | **`json` est le rapport complet ; `agent-text` en est une projection à perte.** Jamais l'inverse : tout champ du texte existe en `json` avec le même sens. | Les `id` sont en json seul, les `[n]` en texte seul, `snippet` en json seul. C'est `json` que consommera MCP, il ne peut pas être le plus pauvre des deux. |
| 15 | **Aucun repli silencieux.** Version de TS hors plage, peer introuvable, tsconfig illisible ⇒ **sortie 2** avec un message nommant ce qui a été cherché et où. Jamais un avertissement sur stderr, jamais un « on continue quand même ». | Les agents ignorent stderr. Un outil qui prêche la lisibilité des pannes doit rendre les siennes lisibles : `0` = propre, `1` = erreurs de type, `2` = tssift n'a pas pu tourner. |

La règle 1 est **testable** : un test parcourt tous les `Fact.text` produits sur les fixtures et échoue s'il y trouve un verbe à l'impératif ou une modalité prescriptive (`ajoute`, `remplace`, `corrige`, `utilise`, `il faut`, `devrait`, `add`, `change`, `should`, `try`). Ce test doit exister dès qu'un enrichisseur existe.

---

## Architecture — où va quoi

Trois étages strictement séparés (PROJECT.md §3). Le pipeline est agnostique de la source.

```
src/
  types.ts              modèle de données §4 — source de vérité, ne pas dupliquer ailleurs
  codes.ts              liste déclarative des codes à contexte — pilote la capture sélective
  sources/
    index.ts            interface DiagnosticSource → { diagnostics, facts }
    ts-api.ts           TsApiSource — TS 5.4–5.9, createProgram + Checker (P0)
    context.ts          résolution sélective de DiagnosticContext, un resolver par code (P1)
    ts7-api.ts          Ts7ApiSource — typescript/unstable/sync (P2.5, pas avant)
    tsc-text.ts         TscTextSource — parse de la sortie tsc (fallback)
  pipeline/
    dedupe.ts           identité stable, suppression des doublons
    causality.ts        racine/dérivé, graphe          ← composant à plus forte valeur
    group.ts            regroupement par symbole & déclaration
    enrich/
      index.ts          table code → enricher
      2769.ts 2345.ts … un fichier par code
    budget.ts           troncature sous contrainte de tokens (P1, avec son drapeau)
  render/
    agent-text.ts       défaut — projection à perte de json (règle 14)
    json.ts             le rapport complet — c'est ce que consommera MCP
    human.ts            plus tard
  cli.ts
test/                   unitaires + snapshots
fixtures/<nom>/         meta.json · before/ · after/
eval/                   harnais de run, résultats
.plans/                 plans d'exécution datés, écrits pour un agent sans contexte
```

Signal d'alerte : si un fichier de `pipeline/` importe `typescript`, la règle 4 est cassée.

---

## Modèle de données

`src/types.ts` transcrit **littéralement** PROJECT.md §4 : `SourceSpan`, `RelatedInfo`, `MessageChainNode`, `DiagnosticContext`, `NormalizedDiagnostic`, `ProgramFacts`, `SymbolRef`, `EnrichedDiagnostic`, `Fact`. Ne pas improviser de champs. Si un champ manque pour une tâche, l'ajouter à PROJECT.md §4 **dans le même changement**, avec la raison.

Points d'attention :
- `id` = `sha256(code|file|line|col|message)`, **12 hex**. « Stable entre runs » = **déterministe à entrée identique**, rien de plus : un `id` ne survit ni à une édition du source ni à une montée de version TS. En `json` seulement.
- `SourceSpan.file` est **relatif au dossier du tsconfig résolu**, séparateurs POSIX, jamais absolu. Chemins hors racine normalisés (`<ts-lib>/…`, suffixe `node_modules/…`) — sinon un snapshot embarque un `/home/<user>/…` et meurt ailleurs.
- `line` / `column` sont **1-indexés** ; l'API TS renvoie des offsets 0-indexés. Convertir à l'ingestion, une seule fois.
- `related` porte le **texte** du related, pas seulement sa position — c'est là que vit l'information utile de 2769 et 2345. `span` est optionnel : en TS 7 un related peut n'avoir aucun `fileName`.
- `chain` est un **parcours préfixe + `depth`**, encodage sans perte d'un arbre ordonné. Le `code` par nœud est indispensable : une chaîne 2769 se termine typiquement sur un 2345.
- `context` est rempli par la **source**, jamais par le pipeline. `subject` / `expected` / `actual` ne sont plus sur `EnrichedDiagnostic` : tels qu'ils y étaient, aucune couche n'avait le droit de les peupler.
- `snippet` est capturé toujours, rendu jamais (json seulement).

---

## Stack & commandes

Rien n'est encore installé. Cible (PROJECT.md §9) :

| | |
|---|---|
| Toolchain **locale** | **mise** — `mise.toml` à la racine épingle node et bun. Rien n'est installé « à la main ». **La CI ne lit pas ce fichier**, elle installe ses propres versions par matrice |
| Runtime **cible** | **Node ≥ 20.19** (`engines`) — la sortie est ESM seule et `require()` d'un ESM n'existe que depuis 20.19. Épinglé à 20 en dev pour ne pas dépendre par accident d'une API plus récente que la promesse |
| Gestionnaire de paquets **dev** | **bun** (`bun install`, `bun run`) — choix interne, invisible pour les consommateurs |
| Langage | TypeScript strict |
| Build | **`tsc`, aucun bundler** — ESM seul + `.d.ts` + `bin`. Zéro dépendance runtime ⇒ rien à empaqueter, et `tsc` préserve le shebang dont dépend la règle 11 |
| Tests | Vitest, snapshots, **exécuté sous Node** (règle 11) |
| Lint/format | Biome |
| Releases | Changesets |
| CI | GitHub Actions — trois axes séparés (TS · Node · installateurs) + un job de garde TS 7, Ubuntu seul. PROJECT.md §9.2 |
| Repo | mono-package d'abord ; split `core`/`cli`/`mcp` seulement si nécessaire |

Scripts à créer en P0 et à utiliser ensuite systématiquement :

```bash
mise install                    # installe la toolchain épinglée par mise.toml
mise exec -- bun install
mise exec -- bun run build      # tsc → ESM + .d.ts, pas de bundler
mise exec -- bun run test       # vitest → délégué à Node par le shebang
mise exec -- bun run test:watch
mise exec -- bun run check      # biome check --write
mise exec -- bun run typecheck  # tsc --noEmit sur notre propre code
mise exec -- bun run eval       # harnais d'éval (B0+)
```

`mise exec --` résout les outils depuis le `mise.toml` de l'arborescence courante ; hors du dépôt il faut nommer l'outil (`mise exec bun@1.3.14 -- …`). Dans un shell interactif où mise est activé, le préfixe est superflu — mais **les docs gardent la forme explicite**, parce que le shell d'un agent ne l'est pas forcément (règle 12).

À l'inverse, les scripts de `package.json` ne préfixent **jamais** par mise : ils doivent rester exécutables tels quels par la CI et par quiconque n'utilise pas mise. Le préfixe est une convention d'invocation locale, pas une dépendance du projet.

État vérifié le 2026-07-27 : `mise exec -- node --version` → **v20.20.2**, `bun` → **1.3.14**. Il existe aussi un bun installé hors mise dans `~/.bun` et un Node système v22.22.1 : ce sont des doublons, ne pas les viser.

Pas de pnpm ni de yarn sur la machine — les scénarios qui les concernent se testent en CI, pas localement.

**L'épinglage s'arrête au poste de dev.** La CI installe ses propres versions : son rôle est de balayer une matrice (TS 5.4 → 5.9, plusieurs Node, plusieurs installateurs), qu'une version unique épinglée contredirait. Ne pas introduire `jdx/mise-action` ni faire lire `mise.toml` par un workflow.

Conséquence à tenir : **la version de Node de `mise.toml` doit toujours figurer dans la matrice CI.** Si l'une des deux bouge, l'autre bouge dans le même changement — sinon on développe quotidiennement sur une configuration que rien ne teste.

Un seul lockfile est commité : `bun.lock`. `package-lock.json`, `yarn.lock` et `pnpm-lock.yaml` vont dans `.gitignore` — un second lockfile commité est un piège à dérive de versions.

---

## Prise en charge de tous les gestionnaires de paquets

Exigence produit, pas seulement confort de dev. Rationnel complet dans PROJECT.md §9.1 ; en pratique, deux endroits du code sont concernés et un seul est évident.

**1. L'enrichisseur `2307` — c'est là que ça se joue.** Il doit distinguer « paquet absent de `package.json` » de « types manquants » de « chemin cassé » de « dépendance non déclarée mais résolue par hoisting ». Ces distinctions dépendent entièrement de la topologie installée, qui n'est pas la même selon l'installateur :

| Installateur | Topologie | Ce qui change pour nous |
|---|---|---|
| npm · yarn (node-modules) · bun | `node_modules/` à plat, hoisting | une dépendance **non déclarée** peut se résoudre quand même |
| pnpm | `node_modules/.pnpm/` + liens symboliques, strict | une transitive non déclarée **ne résout pas** — 2307 fréquent et invisible dans le message TS |
| yarn PnP | **aucun `node_modules`**, `.pnp.cjs` | tout code qui suppose `node_modules` casse net |

**2. Le point d'entrée.** Il doit démarrer sous `npx tssift`, `bunx tssift`, `pnpm dlx tssift`, `yarn dlx tssift`. La `peerDependency` `typescript` ne se résout pas pareil partout (npm ≥ 7 l'installe seul, pnpm non par défaut, yarn PnP échoue durement si elle manque) — c'est le premier endroit où le CLI peut ne pas se lancer du tout.

En pratique :
- Détecter l'installateur par lockfile (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lock`) et l'exposer comme `Fact` de type `origin`.
- Lire uniquement des fichiers déclaratifs : `package.json`, lockfile, `.pnp.cjs`, `tsconfig.json`. Jamais de sous-processus (règle 10).
- Gérer les protocoles d'espace de travail : `workspace:`, `catalog:`, `link:`, `portal:` — c'est la fixture monorepo cross-package.
- Rester factuel : « `zod` n'apparaît pas dans les `dependencies` de `package.json` », jamais « installe `zod` » (règle 1).

**Les deux fixtures dédiées existent depuis le 2026-07-28** : `phantom-dependency-pnpm` et `yarn-pnp-project`, arborescence installée commitée. Ce qu'elles ont déjà montré, avant qu'une ligne d'enrichisseur soit écrite :

- **Le message TS est le même dans les quatre installateurs alors que la vérité derrière lui ne l'est pas.** `Cannot find module 'qs'` ne dit rien du hoisting, rien du fait que le paquet est installé et joignable un cran plus bas, rien du fait que le même code compile sous npm. Tout ce qui le dirait est dans des fichiers déclaratifs — c'est exactement le matériau de l'enrichisseur 2307.
- **Sous Yarn PnP, `before/` ne contient aucun bug et sort quand même trois TS2307.** Le compilateur est lancé en processus Node nu et ne charge donc jamais la carte de résolution de `.pnp.cjs`. **tssift est un processus Node nu** : il produira la même sortie — plausible et entièrement fausse — s'il n'est pas lancé au travers du runtime (`yarn tssift`). À trancher : détecter un `.pnp.cjs` sans `process.versions.pnp` et sortir en 2 (règle 15) plutôt que de rendre un rapport propre sur une lecture cassée.

## Conventions de code

- **TypeScript strict**, pas de `any` non justifié, pas de `as` sans commentaire d'une ligne.
- Fonctions pures dans `pipeline/` : entrée `Diagnostic[]` → sortie `Diagnostic[]`. Aucun I/O, aucun état global. C'est ce qui rend le tout testable au snapshot.
- Le code, les identifiants et les commentaires sont en **anglais**. La documentation projet (`PROJECT.md`, `AGENTS.md`, `EVAL.md`) est en **français**.
- Pas de dépendance runtime nouvelle sans la justifier — le paquet doit rester léger et installable en `npx`.
- Les messages produits par le renderer sont du **contenu de test** : tout changement de format casse des snapshots, c'est voulu. Relire le diff de snapshot, ne jamais le régénérer en aveugle.

---

## Recette — ajouter un enrichisseur

Périmètre V1 : les 10 codes de PROJECT.md §5.2, par ordre de rentabilité (2769, 2345, 2339, 2353, 2322, 2307, 2554, 2739/2741, 18047/18048, 2551). **Couvrir 10 codes bien vaut mieux que 60 à moitié.** Hors table ⇒ format natif.

1. Écrire d'abord la **fixture** qui déclenche le code. Sans fixture, pas d'enrichisseur.
2. Vérifier que tout ce dont l'enrichisseur a besoin est **déjà dans `NormalizedDiagnostic`**. Si non : l'ajouter à la capture dans `sources/ts-api.ts`, pas à l'enrichisseur (règle 4).
3. Implémenter `src/pipeline/enrich/<code>.ts`, l'enregistrer dans `enrich/index.ts`.
4. Ne produire que des `Fact` **vérifiables** : une déclaration et sa position, une liste de membres, une distance de Levenshtein. Pas d'interprétation.
5. Retourner `confidence: 'low'` au moindre doute — le repli natif est un succès, pas un échec.
6. Test de non-prescription + snapshot.
7. **2551 (« Did you mean X ») est déjà bon nativement : surtout ne pas le dégrader.**

## Recette — ajouter une fixture

```
fixtures/<nom-kebab>/
  meta.json     { rootCause, expectedFix, tags, difficulty, purpose?, deviatesFromCanonicalConfig? }
  before/       projet cassé, ne compile pas
  after/        état corrigé attendu
```

`rootCause` et `expectedFix` sont la vérité terrain que lira le harnais d'éval — ils décrivent le correctif, et c'est leur rôle ; la règle 1 porte sur les `Fact.text` produits par l'outil, pas sur les métadonnées de fixture. `tags` porte les codes TS attendus (`TS2769`…), ce qui rend visible en diff le jour où une version de TS change de code. `purpose` est **optionnel** et dit pourquoi la fixture existe — ce qu'elle est le seul témoin à couvrir, ou ce qu'elle ne doit jamais produire. `deviatesFromCanonicalConfig` est **optionnel et obligatoire dès qu'il y a déviation** : il nomme ligne à ligne ce qui s'écarte du bloc canonique ci-dessous, sans quoi un lecteur ne peut pas distinguer un écart voulu d'une fixture écrite de travers.

Catégories à couvrir (PROJECT.md §7) : barrel export cassé ✓ · renommage d'interface partiel ✓ · erreur de surcharge ✓ · générique mal contraint ✓ · module absent ✓ · nullabilité ✓ · union discriminée mal narrowée ✓ · import de type manquant ✓ (`missing-type-import`, TS1484) · mauvais `paths` tsconfig ✓ · monorepo cross-package ✓ · dépendance fantôme sous pnpm ✓ · projet Yarn PnP ✓. **Toutes les catégories de §7 sont couvertes**, et les vingt de §8 lot B sont atteintes (T0 de B1).

Les deux fixtures d'installateur demandaient une arborescence installée réaliste, et elle est **commitée** depuis le 2026-07-28 : `phantom-dependency-pnpm` porte les liens symboliques `node_modules/.pnpm/…` de pnpm, `yarn-pnp-project` porte un `.pnp.cjs` et un `.yarn/unplugged/` sans le moindre `node_modules`. La commiter plutôt que de la générer au moment du test est ce qui rend la fixture reproductible sans réseau et sans que pnpm ni yarn soient installés localement — ils ne le sont pas. Deux conséquences à connaître : `node_modules/`, `pnpm-lock.yaml` et `yarn.lock` sont réadmis sous `fixtures/` par des exceptions du `.gitignore`, et les lockfiles y sont **écrits à la main**, leurs `checksum` étant des marqueurs et non de vrais hachages — chaque fichier le dit dans son en-tête, parce qu'un faux hachage d'apparence crédible est un piège.

Une fixture est **obligatoire et prioritaire** : `two-independent-roots`, deux racines réellement indépendantes. Zéro faux positif de causalité dessus est un critère de la Definition of Done.

**Les trois premières**, écrites avant tout code moteur : `partial-interface-rename` · `two-independent-roots` · `overload-mismatch`. Justification en PROJECT.md §7. `broken-barrel-export` est la quatrième et comble le trou connu du trio : deux fixtures sur trois sont mono-fichier.

**Chaque `before/` est autonome.** Son propre `tsconfig.json` complet, **aucun `extends` sortant du dossier** : le bras A de l'éval est un modèle qui lance `tsc --noEmit` dans une *copie* de `before/`, et une copie doit rester exécutable. La duplication est le prix de cette propriété.

Bloc canonique, recopié tel quel dans chaque fixture générique :

```json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler"
  }
}
```

Pourquoi celui-là : `NodeNext` exigerait une extension `.js` sur chaque import relatif et couvrirait les fixtures de TS2835 ; `skipLibCheck` laissé au défaut ferait entrer du bruit `@types` dans les snapshots ; `lib: ["ES2022"]` sans DOM réduit les globaux ambiants, donc la variance entre versions de TS. Les fixtures dont le sujet **est** la configuration (mauvais `paths`, monorepo, PnP) dévient délibérément et l'écrivent dans `meta.json`.

Chaque fixture doit avoir un `before/` qui échoue réellement à la compilation — vérifier avec `tsc --noEmit` sous **5.4.5 et 5.9.3** avant de commiter, pas seulement sous la version de dev.

---

## Le harnais d'éval

Il se construit **en parallèle** du moteur, pas après. Sans chiffres, le projet est un formateur cosmétique de plus.

Protocole (PROJECT.md §7) : par fixture, deux bras — **A** = `tsc --noEmit` brut, **B** = sortie enrichie. Même modèle, même prompt, même budget de tours, **n=5** runs (la variance n'est pas négligeable).

**B0 n'appelle aucun modèle.** La métrique tokens est la taille de A comparée à celle de B : diagnostics affichés, **caractères**, et une estimation `chars / 4` dont le diviseur est annoncé. Le caractère est le primitif publié — reproductible sans faire confiance à notre tokenizer, et le rapport A/B est de toute façon quasi indépendant du tokenizer. Aucune dépendance, aucune clé d'API, premier chiffre de H1 dans la même semaine que P0, sur les fixtures **et** sur des dépôts réels.

**B1+ utilise un harnais maison** : boucle minimale sur l'API Messages, trois outils que nous implémentons (`read_file`, `write_file`, `run_typecheck`), sur une copie de la fixture. Les faux départs se mesurent en interceptant `write_file` — c'est la raison de ne pas déléguer la boucle à un agent tiers dont on lirait le transcript après coup. Modèle de classe Sonnet.

Métriques modèle : correction au 1er essai · tours avant `tsc` vert · **taux de faux départ** (édition d'un fichier non impliqué — le cœur de H1) · régressions.

Résultats dans `EVAL.md`, y compris ceux qui infirment une hypothèse. Si H1 se confirme et H2 non : on l'assume, on le documente, l'outil devient « un dédupliqueur de diagnostics » et le README en est meilleur.

Attendu à ne pas prendre pour un bug : le seuil de causalité étant volontairement strict (PROJECT.md §5.1), les premiers chiffres **sous-estimeront** ce qu'une règle plus lâche revendiquerait.

---

## Décisions ouvertes — ne pas trancher seul

1. ~~**`tsdown` vs `tsup`**~~ — **dissoute** le 2026-07-27 : zéro dépendance runtime ⇒ rien à empaqueter ⇒ pas de bundler. `tsc` seul, ESM seul. À rouvrir uniquement si un consommateur réel demande du CJS sous Node < 20.19.
2. **Licence des corpus tiers** — `ts-error-translator` (Matt Pocock). **Parquée** : son unique consommateur possible est H2, différé derrière les chiffres. Rien à décider tant que B2 n'a pas montré qu'un code y gagne.
3. ~~**Portée de la matrice d'installation**~~ — **tranchée** : npm · pnpm · yarn (node-modules) · yarn (PnP) · bun, Ubuntu seul. **Windows hors périmètre v0.1**, écrit dans le README. Deno/JSR hors périmètre tant que personne ne le demande.

*Tranchées le 2026-07-27 :* nom du paquet = **`tssift`** · gestionnaire de paquets dev = **bun** · runtime de test = **Node** · plage TS = **5.4 → 5.9**, refus en sortie 2 au-delà · sortie du renderer en **anglais**, message TS **brut** · seuil de causalité **structurel uniquement** · B0 **sans modèle**.

Ces dernières sont documentées en détail dans PROJECT.md. Les rouvrir demande une raison neuve, pas une préférence.

---

## Prior art à lire avant d'écrire du code

`ts-error-translator` · `pretty-ts-errors` · `tsc-output-parser` · `typescript/src/compiler/diagnosticMessages.json` (source de vérité des codes).

Les trois premiers visent **l'humain dans l'éditeur**. Le créneau « consommateur = agent, sortie structurée, hiérarchisée » est le nôtre. Si en les lisant ce constat s'avère faux, **le dire tout de suite** — c'est l'information la plus utile qu'on puisse produire à ce stade.

**C'est une porte d'arrêt, pas une lecture de culture générale.** Les trois nommés se parcourent juste assez pour confirmer leur cible. L'effort utile porte ailleurs : chercher sur npm et GitHub un post-processeur de `tsc` **orienté agent ou MCP** publié récemment. Ces trois-là datent d'avant que « outil consommé par un agent » soit une catégorie ; le risque n'est pas `pretty-ts-errors`, c'est quelque chose sorti pendant l'écriture de la spec. Note courte, résultat négatif inclus. Si le créneau est occupé : **s'arrêter et le dire**, avant P0.

---

## Git

Le dépôt est **initialisé sur `main`** depuis le 2026-07-27, avec `LICENSE` (MIT © 2026 Elie Laloum) et un `.gitignore` couvrant `dist/`, `node_modules/`, `coverage/`, `.eval-dist/` et les trois lockfiles étrangers (§9.1).

**Un remote existe depuis le 2026-07-28** : `origin` → `git@gitlab.elielaloum.com:elielaloum/tssift.git`. Il est **auto-hébergé, sur GitLab et non GitHub** — deux conséquences à ne pas confondre. D'abord, `gh` n'y sert à rien, et il n'est de toute façon pas installé : pas de commande de PR depuis un agent. Ensuite, **la CI de `.github/workflows/` n'y tourne pas** ; elle attend un miroir GitHub qui n'existe pas encore, donc la matrice trois axes n'est aujourd'hui vérifiée par personne en dehors des vérifications locales. C'est un trou connu, pas un oubli.

**Commit à chaque jalon terminé, sans demander** — fixtures, moteur P0, renderers, CLI, B0. C'est un assouplissement délibéré de la règle « ne commiter que sur demande » : la discipline « un diff de snapshot se lit » exige une base contre laquelle lire, et un long chantier non commité rend le premier diff illisible.

**Ne jamais pousser sans demande explicite** — la demande vaut pour la session où elle est faite, pas à perpétuité.

---

## Avant de dire « c'est fini »

- [ ] `mise exec -- bun run typecheck`, `… run test`, `… run check` passent
- [ ] Aucun binaire appelé par chemin absolu, aucun `--bun` (règles 11 et 12)
- [ ] Les snapshots modifiés ont été **relus**, pas juste régénérés
- [ ] Aucun impératif dans les `Fact` produits (règle 1)
- [ ] Aucun import de `typescript` sous `pipeline/` (règle 4)
- [ ] Aucun diagnostic supprimé ; `--all` restitue tout (règle 2)
- [ ] Aucun `node_modules/` présumé, aucun sous-processus de gestionnaire de paquets (règle 10)
- [ ] Sortie en anglais, message TS brut, aucun `restated` non justifié par l'éval (règle 13)
- [ ] `json` contient tout ce que le texte contient (règle 14)
- [ ] Aucun repli silencieux : hors plage ⇒ sortie 2 nommée (règle 15)
- [ ] Un seul lockfile commité (`bun.lock`)
- [ ] Si une décision de PROJECT.md a changé, PROJECT.md est mis à jour **dans le même changement**
- [ ] Ce qui a été mesuré est rapporté tel quel, y compris si le chiffre est mauvais
