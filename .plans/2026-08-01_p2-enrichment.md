# P2 — l'enrichissement, première tranche

Date : 2026-08-01
Porte de décision PROJECT.md §7 : **ouverte** après B1 (feu vert humain donné ce jour).

## Ce qui a été livré

`src/pipeline/enrich/` n'est plus vide. Six codes ont un enrichisseur — **2339,
2353, 2345, 2554, 2305, 2724** — plus l'étage `enrich()`, son câblage dans
`run.ts` et dans `eval/measure.ts`, et le rendu des faits dans `agent-text`.

**La règle de sélection, et c'est elle le livrable conceptuel :** un enrichisseur
sort quand le fait qu'il produit est **déjà capturé** et que **TypeScript ne
l'imprime pas déjà**. Elle est appliquée sans exception, et elle exclut quatre
entrées de §5.2 pour des raisons nommées plutôt que par manque de temps.

| fichier | rôle |
|---|---|
| `enrich/facts.ts` | constructeurs de `Fact` partagés — un seul endroit décide de la formulation |
| `enrich/2339.ts` · `2353.ts` · `2345.ts` · `2554.ts` · `2305.ts` | un fichier par code, convention AGENTS.md |
| `enrich/index.ts` | la table `code → enricher`, et le raisonnement pour les codes absents |
| `test/enrich.test.ts` | 53 tests, dont **le scan de non-prescription rendu obligatoire par la règle 1** |

## Les quatre mesures qui ont décidé du contenu

1. **Le near-match n'existe pas.** TypeScript émet TS2551/TS2724 *à la place de*
   TS2339/TS2305 dès que son correcteur trouve un candidat : tout diagnostic
   parvenant à un enrichisseur est un cas qu'il a déjà rejeté. À seuil comparable
   (`len × 0,4 + 1`, transcrit de `getSpellingSuggestion`), une suggestion se
   déclenchait **38 fois** sur les 20 fixtures et les 5 cascades de corpus, sur
   **deux noms**, et était **fausse les deux fois** — `kind` → `id` et
   `side` → `id`, sur `shape-tag-renamed`, la cascade qui résiste déjà à 100 %
   dans les deux bras en B1. Aucun `Fact` de type `near-match` n'est produit, et
   un test le garde.
2. **2769 est le moins rentable des dix, pas le plus.** Sa charge utile est déjà
   dans `chain` depuis P0. Le classement que §5.2 voulait ajouter n'est pas
   dérivable : sur `overload-mismatch` les trois branches ont même profondeur et
   une feuille chacune.
3. **`typeToString` d'un type nommé rend son nom.** La maquette de §6 montrait
   une forme développée qui n'existe pas ; c'est la **liste des propriétés** qui
   porte l'information sur un type nommé. La forme n'est rendue que là où elle
   n'est pas le nom — signature résolue, type anonyme.
4. **« member » est le mauvais mot.** Pour une union, un *member* est un
   constituant. La sortie dit `property` pour un type, `export` pour un module.
   Révélé par `narrowed-union-member`.

## Le coût, mesuré contre la ligne de base P1

Même harnais B0, mêmes 25 cibles, seule variable l'étage `enrich` + la ligne de
fait sous l'en-tête de cause.

- **Total : 16 861 → 17 538 caractères, soit +4,0 %. Le rapport B/A passe de
  54 % à 56 %.**
- **Sur les cinq cascades de corpus : +38 à +83 caractères**, soit 10 à 20
  tokens, pour un site de déclaration et la liste des propriétés réelles. Elles
  restent entre 9 % et 41 % de `tsc` brut.

La raison de ce prix dérisoire est structurelle : **les faits se rendent une fois
par groupe, pas une fois par diagnostic.** Sous `--all` il n'y a plus de groupe
pour amortir et chaque diagnostic reporte ses faits — c'est voulu, et c'est là
que l'enrichissement est cher.

## Un effet de bord à connaître : le plancher du budget a monté

La forme irréductible d'un groupe (en-tête + compte, sans ligne de membre) est
passée de ~55 à ~68 tokens sur `partial-interface-rename`. En dessous, la règle 6
prend la main et rend l'entrée entière. `test/budget.test.ts` porte désormais une
constante `ABOVE_FLOOR = 80` qui le dit, plus un test qui épingle le comportement
sous le plancher pour qu'il ne se lise pas comme une régression.

## Un garde-fou ajouté au harnais d'éval

Le `.corpus/` privé (trois copies dérivées d'un dépôt disparu de cette machine)
rendait bras A = 0 diagnostic et bras B = 754, ce qui donnait un total publié à
**`B/A 1235 %`**. `measure.ts` marque désormais ces lignes `incoherent`, les
exclut des totaux et imprime la raison : les deux bras lisent le même tsconfig
avec le même compilateur, donc « A trouve 0, B trouve beaucoup » n'est pas un
résultat mais une cible périmée.

## Vérification

- `mise exec -- bun run typecheck` — passe.
- `mise exec -- bun run test` — **518 tests**, tous verts (464 avant P2).
- `mise exec -- bun run check` — 52 fichiers, aucune correction.
- `mise exec -- bun run fixtures:verify` — passe sous 5.4.5 et 5.9.3.
- `mise exec -- bun run eval` — table à jour, reportée dans `EVAL.md` § P2.
- **14 snapshots relus avant régénération** : le diff est **purement additif**,
  59 insertions et 0 suppression. Les deux témoins négatifs gardent leur compte
  d'entrées (`two-independent-roots` 2, `two-roots-one-file` 2 groupes).

## Ce qui reste de §5.2, et ce qui le débloquerait

| code | ce qui manque |
|---|---|
| **2322** | les deux types comme structures ; seul l'attendu est capturé, et comme `SymbolRef` |
| **2307** | un canal `ProgramFacts` neuf portant la topologie installée — un étage de pipeline ne lit pas de fichiers (règle 4) |
| **18047 / 18048** | une analyse de flot de contrôle ; rien de capturé n'y répond |
| **2739 / 2741** | la liste complète des manquants ; TypeScript tronque la sienne et rien ne capture le reste |

**2551 et 2769 ne reviendront pas** sans une mesure neuve : le premier est déjà
bon nativement, le second est déjà entièrement dans `chain`.

## Fichiers touchés

- `src/pipeline/enrich/` (nouveau : `index.ts`, `facts.ts`, `2305.ts`, `2339.ts`,
  `2345.ts`, `2353.ts`, `2554.ts`)
- `src/pipeline/index.ts` · `src/run.ts` · `src/render/agent-text.ts`
- `eval/measure.ts`
- `test/enrich.test.ts` (nouveau) · `test/render.test.ts` · `test/budget.test.ts`
- `test/__snapshots__/render.test.ts.snap`
- `PROJECT.md` §5.2 et §6 · `EVAL.md` § P2 · `AGENTS.md`
