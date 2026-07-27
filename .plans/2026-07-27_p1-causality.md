# Plan d'exécution — P1 · Causalité

**Date :** 2026-07-27
**Portée :** P1 tel que défini dans PROJECT.md §8 — détection racine/dérivé, regroupement, tri par pouvoir explicatif, budget de tokens.
**Écrit pour** un agent qui démarre sans le contexte de la session qui a produit ce plan.
**Prédécesseur :** `.plans/2026-07-27_p0-b0.md` (clos). Verdict du créneau : `.plans/2026-07-27_prior-art.md`.

---

## État d'avancement — mis à jour le 2026-07-27

| tâche | état | note |
|---|---|---|
| T0 · trou du tsconfig solution | **livré** | et la seconde branche s'est révélée **inatteignable** : TypeScript signale déjà TS18002/18003 dès que `references` manque. Ce qui *renforce* le discriminant retenu. |
| T1 · étendre la capture | **livré** | 2305 · 2339 · 2345 · 2353 · 2554. Taux 92 – 100 %. Coût en temps dans le bruit (−6 à +8 %), coût en volume `json` réel (+16 à +69 %). |
| T2 · `pipeline/dedupe.ts` | **livré** | taux de doublons mesuré : **zéro** sur 283 diagnostics. Module minimal, mais contrat non trivial — l'`id` seul ne suffit pas à supprimer. |
| T3 · `pipeline/causality.ts` | **livré** | conçu en plan mode. Règle du `declaredAt` identique uniquement. |
| T4 · `group.ts`, tri, plafonds | **livré** | plafond à 3 sites, `--all` byte-identique à P0. |
| T5 · `budget.ts` + `--budget-tokens` | à faire | |
| T6 · `broken-barrel-export` | à faire | c'est avec elle qu'arrive la règle 2307 différée en T3 |
| T7 · le chiffre de H1 | **livré** | **283 diagnostics → 29 entrées, 141 % → 20 % de caractères.** Détail dans `EVAL.md`. |

**Les trois questions de conception de T3 sont tranchées, deux par la mesure plutôt que par décision :**

1. **Une cause sans diagnostic** — tranchée : le groupe est en-têté par la **déclaration**. Ce n'est pas un cas limite mais **le seul cas observé** : `members-on-cause = 0` dans 100 % des groupes. §4 gagne `DiagnosticGroup` / `DiagnosticReport`, §6 est amendée.
2. **Le span d'un `related` compte-t-il comme un `declaredAt` ?** — **question devenue sans objet.** `getResolvedSignature().declaration` résout 152/152 sur TS2554, et c'est le lien structurel ordinaire que §5.1 règle 2 décrit déjà. La plus grosse cascade du corpus se plie **sans desserrer le seuil**. Aucun amendement.
3. **2305 et 2307 partagent-ils une règle ?** — **non.** Le module d'un 2305 *résout*, donc c'est déjà un cas de `declaredAt` identique (12/12). Celui d'un 2307 ne résout par définition pas. Ils se ressemblent dans le message et pas du tout dans la structure. La règle 2307 est **différée en T6**, écrit en §5.1.

**Un garde-fou ajouté, non prévu au plan, et sorti de la mesure :** une déclaration hors des fichiers du programme (`<ts-lib>/…`, `node_modules/…`) ne peut pas être une cause. Un TS2345 du corpus résout vers `interface Map` de la lib standard ; sans ce refus, deux bugs indépendants fusionneraient. C'était déjà dans les données avant la première ligne de causalité.

---

## Comment se servir de ce fichier

Lire dans cet ordre, avant toute action : `AGENTS.md` (règles dures) → `PROJECT.md` (spec) → `EVAL.md` (les chiffres de base) → ce plan.

**La spec gagne.** Si ce plan et PROJECT.md divergent, PROJECT.md a raison et ce plan se corrige dans le même changement.

**Toute commande locale est préfixée par `mise exec --`.** Jamais de chemin absolu vers un binaire, jamais `--bun` (règles 11 et 12).

---

## Contexte minimal

Couche de post-traitement des diagnostics `tsc` pour un **agent** qui lance `tsc --noEmit` dans un shell. On regroupe par cause racine, on trie par pouvoir explicatif, on attache des faits vérifiables. **On ne dit jamais quoi corriger.**

**P1 est le jalon qui fait le produit.** La vérification du créneau (T0 de P0) a montré que le positionnement « diagnostics structurés pour agent » est déjà occupé par trois serveurs MCP — mais qu'aucun ne **hiérarchise**. Ce qui reste à `tssift` se confond donc exactement avec ce plan. Un `tssift` arrêté à P0 est un `tsc-output-parser` avec un en-tête.

---

## État à l'ouverture de P1

**Existe et fonctionne** (`mise exec -- bun run typecheck && … test && … check` passe, 70 tests) :

```
src/types.ts          modèle §4, n'importe rien
src/codes.ts          CONTEXT_CAPTURE_CODES — déclaré, consommé, VIDE
src/errors.ts         TssiftUnrunnable → sortie 2
src/sources/index.ts  DiagnosticSource
src/sources/ts-api.ts la SEULE couche qui voit `typescript`
src/render/index.ts   RenderInput, formats
src/render/json.ts    le rapport complet
src/render/agent-text.ts  projection à perte
src/run.ts            la logique CLI, testable sans spawn
src/cli.ts            shebang + point d'entrée
fixtures/             3 fixtures de contrat
eval/measure.ts       B0
eval/corpus.json      3 entrées de corpus réel
scripts/              verify-fixtures.mjs, build-corpus.mjs
.github/workflows/    3 axes + garde TS 7 + lint
```

**N'existe pas du tout : `src/pipeline/`.** Ni dedupe, ni causalité, ni groupe, ni enrichissement, ni budget. C'est le périmètre de ce plan (sauf enrichissement = P2).

---

## Faits établis en P0 — ne pas re-sonder

| Fait | Valeur |
|---|---|
| `mise exec -- node --version` / `bun --version` | v20.20.2 / 1.3.14 |
| TypeScript de dev | 5.9.3 épinglé ; `typescript-5.4` en alias pour le garde-fou des fixtures |
| Dépôt git | initialisé sur `main`, remote `git@gitlab.elielaloum.com:elielaloum/tssift.git`, **push autorisé sur `main` uniquement** |
| Miroir GitHub | géré par l'humain. Les `.md`, workflows et le README visent GitHub même si l'on pousse sur GitLab |
| `gh` / `glab` | non installés |
| pnpm, yarn | absents de la machine — leurs cellules CI ne sont pas validées localement |
| TS 7 | `require("typescript")` **réussit**, rend `{version:"7.0.2"}`, pas de `createProgram`. Garde vérifiée contre une vraie installation |
| `chain` | exclut le nœud de tête, commence à `depth: 1` |
| `ProgramFacts.imports` | spécificateurs **tels qu'écrits**, pas résolus |
| Diagnostic sans fichier | `file: "<none>"`, 1:1 |
| Historique des dépôts réels | **propre**. 14/14 commits de lekes, 24/240 échantillonnés de data-explorer : zéro diagnostic |
| Corpus | `bun run corpus:build` → `.corpus/`, git-ignoré. 277 diagnostics sur 3 causes racines |

---

## La mesure qui commande ce plan

**À lire avant de toucher à `causality.ts`.** Relevé le 2026-07-27 sur les trois entrées du corpus, en interrogeant la sortie `json` de P0 :

| entrée de corpus | code dominant | diagnostics | portent un `related` |
|---|---|---:|---|
| `lekes-ok-arity-changed` | TS2554 | 153 | **99 %** — 152 pointent tous `src/shared/domain/result.ts:15:33` |
| `lekes-result-value-renamed` | TS2339 | 112 | **0 %** |
| `lekes-task-export-renamed` | TS2305 | 12 | **0 %** |

Trois conséquences, et elles réordonnent le plan :

**1. Deux cascades sur trois ne portent aujourd'hui AUCUN lien structurel.** Le seuil de preuve de §5.1 n'autorise à dériver que sur un lien présent dans les données capturées. Sur 2339 et 2305, il n'y en a pas. **`causality.ts` écrit maintenant ne plierait rien sur 124 des 277 diagnostics du corpus.** D'où T1 : étendre la capture d'abord. `CONTEXT_CAPTURE_CODES` est vide et le mécanisme `captureFor` existe précisément pour ça.

**2. Une cause racine peut n'avoir aucun diagnostic à elle.** Dans `ok-arity-changed`, la cause est la signature de `ok()` — et cette signature est du TypeScript parfaitement valide. Les 153 diagnostics sont tous des sites d'appel. **Il n'y a pas de « diagnostic racine » dont dériver.** Le modèle racine→dérivé de §5.1 ne s'applique pas tel quel ; c'est la règle 2 de §5.1 (« deux diagnostics pointant vers la même `declaredAt` sont regroupés ») qui mord, avec une *cause* qui est une **déclaration**, pas un diagnostic. Le contrat de sortie doit pouvoir exprimer un groupe dont l'en-tête est une position, pas une ligne de diagnostic. **C'est la question de conception n°1 de P1.**

**3. Le gisement est énorme et il est là.** 152 diagnostics repliables en une ligne + un compteur sur une seule entrée. C'est exactement ce que H1 prédit, et c'est la première fois qu'on le voit sur du vrai code.

---

## Décisions liantes

Celles de `.plans/2026-07-27_p0-b0.md` restent valables. S'y ajoutent :

| # | Décision |
|---|---|
| 24 | **Seuil de causalité : liens structurels uniquement** (PROJECT.md §5.1). Exclus : Levenshtein, « même identifiant », « même fichier + même code ». Sous-regrouper est assumé ; sur-regrouper est l'échec classé *critique* en §11 |
| 25 | La règle 3 de §5.1 (« cascades de 2339 sur un même objet ⇒ une seule racine ») **n'est PAS appliquée telle quelle** — « même nom dans le même fichier » n'est pas une identité |
| 26 | **Ne jamais supprimer un diagnostic, seulement le déclasser.** `--all` restitue tout, toujours (règle 2) |
| 27 | `budget.ts` et le drapeau `--budget-tokens` arrivent **ensemble**. Un drapeau qui se parse sans rien faire est un mensonge versionné |
| 28 | Toute extension de `CONTEXT_CAPTURE_CODES` se paie en allers-retours de checker. **Mesurer le coût** avant/après sur `.corpus/lekes-result-value-renamed` (24 fichiers) et le rapporter |

---

## T0 · Le trou du tsconfig « solution » — indépendant, à faire en premier

**Bug de P0, découvert en construisant le corpus.** `~/projects/nextp/keyzia/frontends/data-explorer` porte un tsconfig racine de type *solution* : `"files": []`, `"include": []`, `"references": [...]`. `tsc -p` n'y typecheck **rien** : 0 fichier, exit 0.

`tssift` y imprime donc `0 errors` sur un monorepo entier. On reproduit fidèlement `tsc -p` — bras A et bras B sont d'accord — mais un agent y lit un **faux « propre »**, et c'est précisément le repli silencieux que la règle 15 interdit.

**Attendu.** Détecter le cas (`parsed.fileNames.length === 0`, a fortiori avec `projectReferences` non vide) et le **dire**. Ne pas implémenter `tsc -b` : les project references sont hors périmètre v0.1, et c'est justement pour ça qu'il faut le nommer plutôt que de rendre `0 errors`.

**TRANCHÉ le 2026-07-27 : on discrimine par `references`.** Écrit dans PROJECT.md §9, ne pas rouvrir.

- `fileNames` vide **et** `references` non vide ⇒ **sortie 2**. C'est un tsconfig solution : les erreurs existent, elles sont simplement ailleurs, et l'invocation est mauvaise. Le message nomme le tsconfig, le compte de fichiers, le compte de références, et **liste les chemins référencés** pour que l'agent sache où pointer.
- `fileNames` vide **et** aucune référence ⇒ **sortie 0**, avec `0 errors · 0 files checked`. Là, le « 0 errors » est **vrai** : refuser un projet légitimement vide serait un faux négatif de notre côté.

La raison du découpage : la règle 15 interdit le repli silencieux, pas les sorties 0 exactes. Ce qui est intolérable n'est pas « 0 », c'est un « 0 » **faux**. La présence de `references` est exactement ce qui distingue les deux cas, et elle est déjà dans `parsed.projectReferences`.

Forme attendue :

```
$ tssift --project ./tsconfig.json        # racine de monorepo, 4 references
→ exit 2, stderr :
  Nothing to type-check.
    tsconfig: /repo/tsconfig.json
    0 files matched, 4 project references declared
  tssift analyses one project at a time; project references are not supported.
  Point --project at one of: ./apps/data-explorer, ./apps/widget, …

$ tssift --project ./empty/tsconfig.json   # 0 fichier, 0 référence
→ exit 0, stdout :
  root: empty
  0 errors · 0 files checked
```

**Critères d'acceptation**
- [ ] `fileNames` vide + `references` non vide ⇒ sortie 2, **rien sur stdout**, message nommant tsconfig + comptes + chemins référencés
- [ ] `fileNames` vide + 0 référence ⇒ sortie 0 et `0 files checked`
- [ ] Deux tests, un par branche, sur des tsconfig temporaires hors du dépôt
- [ ] Le cas réel `~/projects/nextp/keyzia/frontends/data-explorer` sort bien en 2
- [ ] `EVAL.md` mis à jour : cette cible passe de « 0 diagnostic » à « refusée », comme `cursor-rules-hooks`

---

## T1 · Étendre la capture — prérequis dur de la causalité

**Objectif.** Donner à `causality.ts` de quoi travailler. Sans ça, T3 ne plie rien sur 2339 ni 2305.

Tout se passe dans `sources/ts-api.ts` et `codes.ts`. **Rien dans `pipeline/`** (règle 4).

1. **`CONTEXT_CAPTURE_CODES`** — y ajouter au minimum `2339` et `2305`, et le justifier par entrée.
2. **Résoudre `DiagnosticContext`** pour ces codes : `subject` (le symbole en cause) avec son `declaredAt`, `expected`, `actual`. C'est la seule couche autorisée à voir le `TypeChecker`.
   - Pour **2339** (`Property 'x' does not exist on type 'T'`) : `subject` = le type `T`, avec `declaredAt` pointant sa déclaration, et `memberNames`. C'est ce qui reliera les 112 diagnostics de `lekes-result-value-renamed` à `src/shared/domain/result.ts`.
   - Pour **2305** (`Module '…' has no exported member 'x'`) : le module visé est déjà dans `ProgramFacts.imports` du fichier fautif — vérifier si `context` est même nécessaire, ou si le canal `imports` suffit. **Mesurer avant d'implémenter.**
3. **Mesurer le coût.** Chronométrer `TsApiSource.load` avant/après sur `.corpus/lekes-result-value-renamed`. Si le surcoût dépasse ~20 %, le dire et discuter la capture paresseuse.

**Critères d'acceptation**
- [ ] Sur `.corpus/lekes-result-value-renamed`, ≥ 90 % des 2339 portent un `context.subject.declaredAt` non vide
- [ ] Ce `declaredAt` pointe bien `src/shared/domain/result.ts`
- [ ] Sur `.corpus/lekes-task-export-renamed`, le module d'origine des 2305 est identifiable (par `context` ou par `imports`)
- [ ] `src/pipeline/` n'importe toujours pas `typescript`
- [ ] Le coût en temps est mesuré et rapporté

**Vérification** — `mise exec -- bun run test`
**Commit** — « feat(sources): selective context capture for 2339 and 2305 »

---

## T2 · `pipeline/dedupe.ts`

Identité stable, suppression des doublons stricts. Fonction pure `(diagnostics, facts) => diagnostics`.

Attention : deux diagnostics de même `id` sont *identiques par construction* (`sha256(code|file|line|col|message)`). Le dédoublonnage n'a d'intérêt que si le programme en produit réellement — **le vérifier sur le corpus avant d'écrire du code**, et si le taux est nul, le dire et livrer un module trivial plutôt qu'une machinerie.

**Critères d'acceptation**
- [ ] Le taux de doublons réel sur les 3 entrées de corpus est mesuré et rapporté
- [ ] Aucun diagnostic non-doublon n'est perdu
- [ ] Fonction pure, aucun I/O

---

## T3 · `pipeline/causality.ts` — le cœur

**À concevoir en plan mode** (CLAUDE.md). C'est le composant à plus forte valeur et le plus facile à rendre faux.

**Le seuil de §5.1, à la lettre.** On ne dérive que sur :
- le diagnostic est dans un fichier dont l'import du module non résolu par la racine a échoué (via `ProgramFacts.imports`) ;
- ou il partage un `declaredAt` **identique** avec la racine ;
- ou son `context.subject` est le symbole que la racine a rendu irrésolvable.

**Trois questions de conception à trancher explicitement**, chacune avec sa raison écrite dans PROJECT.md §5.1 :

1. **Une cause sans diagnostic.** Voir « La mesure qui commande ce plan », point 2. Comment le contrat de sortie exprime-t-il un groupe dont la cause est une déclaration et non un diagnostic ?
2. **Le span d'un `related` compte-t-il comme un `declaredAt` ?** C'est ce qui relierait les 152 TS2554 de `ok-arity-changed` en une ligne. L'argument pour : c'est un lien structurel, produit par le compilateur, présent dans les données capturées — pas une ressemblance. L'argument contre : ce n'est pas littéralement dans la liste de §5.1. **Trancher, et amender §5.1 dans le même changement.**
3. **2305 et 2307 se ressemblent-ils assez** pour partager la règle « tout ce qui importe ce module est dérivé » ?

**La fixture témoin est non négociable.** `two-independent-roots` doit rendre **deux racines**, jamais une racine et un dérivé. Zéro faux positif dessus est un critère de la DoD (PROJECT.md §12).

**Critères d'acceptation**
- [ ] `two-independent-roots` : 2 racines, 0 dérivé. Test dédié, nommé
- [ ] Sur les 3 entrées de corpus, le nombre de racines et de dérivés est mesuré et rapporté
- [ ] Aucune dérivation ne repose sur Levenshtein, un nom identique, ou « même fichier + même code »
- [ ] `pipeline/causality.ts` n'importe pas `typescript`
- [ ] Chaque dérivation est justifiable par une règle nommée de §5.1

---

## T4 · `pipeline/group.ts`, tri, plafonds, déclassement

- Regroupement par symbole et déclaration
- **Tri par pouvoir explicatif** : racines d'abord, par nombre de dérivés décroissant
- **Plafond dur** : au-delà de N dérivés partageant une racine, 3 sites puis `+37 autres usages`
- **Déclassement** : un dérivé perd sa ligne et survit comme position dans la liste `N derived:` de sa racine. **Rien n'est retiré du tableau, seulement du rendu**
- **`--all`** restitue chaque diagnostic en ligne pleine, sans regroupement
- **Ne jamais tronquer une racine** (règle 6)

Le renderer `agent-text` doit apprendre `N derived:` ; `json` doit exposer `role`, `derivedFrom` (règle 14 : tout ce qui est en texte est en json).

**Critères d'acceptation**
- [ ] `--all` rend exactement le même nombre de diagnostics que P0 sur les 3 fixtures et les 3 entrées de corpus
- [ ] Un test compare `--all` au tableau brut de la source : aucune perte (règle 2)
- [ ] Les snapshots des 3 fixtures sont **relus**, pas régénérés en aveugle
- [ ] Aucune racine tronquée sous plafond

---

## T5 · `pipeline/budget.ts` + `--budget-tokens`

Ensemble, jamais l'un sans l'autre (décision 27). Stratégie de troncature, dans l'ordre de §5.3 : types longs abrégés → sites dérivés en compteur → diagnostics à faible rang en `+N erreurs supplémentaires, relancer avec --all`.

**Critères d'acceptation**
- [ ] `--budget-tokens` réduit réellement la taille de sortie, mesuré
- [ ] Aucune racine tronquée, quel que soit le budget
- [ ] `--all` ignore le budget

---

## T6 · La quatrième fixture — `broken-barrel-export`

Le trou connu du trio actuel : deux fixtures sur trois sont mono-fichier. Recette dans AGENTS.md.

**Note issue du corpus** : retirer un export d'un barrel réel n'a produit **aucun** diagnostic sur `lekes`, ses 11 importateurs consommant chacun un symbole différent. La fixture doit donc être construite pour que plusieurs fichiers consomment **le même** symbole du barrel — sinon elle ne teste rien.

**Critères d'acceptation**
- [ ] ≥ 3 fichiers importent le même symbole du barrel
- [ ] Échoue réellement sous 5.4.5 **et** 5.9.3 (`bun run fixtures:verify`)
- [ ] La causalité y voit 1 racine et ≥ 3 dérivés

---

## T7 · Le chiffre de H1

**C'est le livrable qui justifie le projet.** Rejouer B0 après P1 et comparer à la ligne de base d'`EVAL.md`.

```bash
mise exec -- bun run corpus:build && mise exec -- bun run eval
```

Ce qu'on attend : les diagnostics **affichés** de B chutent nettement sous ceux de A sur les entrées de corpus, et le rapport de caractères passe sous 100 %. Ligne de base à battre : **A = 283, B = 283, 141 % de caractères**.

**Rapporter la mesure obtenue, pas la mesure espérée.** Un « P1 ne plie que 30 % » est un livrable. Mettre à jour `EVAL.md` avec la méthode inchangée et la date.

**Critères d'acceptation**
- [ ] `EVAL.md` porte les deux tableaux, avant et après P1, comparables
- [ ] Le taux de repliement est donné par entrée de corpus, pas seulement en total
- [ ] Aucun dépôt réel modifié par la mesure

---

## Pièges connus

- **`bun add` réécrit `peerDependencies`** en version exacte quand le paquet n'est pas déjà en devDependency. La CI l'assert désormais ; le vérifier après tout `bun add`.
- **`bun run --bun` est proscrit** — `test/runtime.test.ts` échoue exprès dessous.
- **Ne jamais régénérer un snapshot en aveugle.** P1 va légitimement les changer : le diff se lit ligne à ligne.
- **`.corpus/` est git-ignoré** et exclu de biome, tsconfig et vitest. Ne jamais y commiter de source : les dépôts visés sont privés, tssift est public.
- **Une ancre de mutation doit viser un fichier suivi au sha épinglé.** `git archive` ignore les non-suivis.
- **`lekes` vivant est instable** — trois mesures en une heure ont donné 23, 29 puis 8 diagnostics. Mesurer sur `.corpus/`, pas sur le dépôt vivant.
- **Un fichier de `pipeline/` qui importe `typescript` casse la règle 4.** Signal d'alerte immédiat.
- **La sortie reste en anglais, le message TS brut** (règle 13). `restated` reste vide : c'est H2, et H2 attend B2.

---

## Hors périmètre de ce plan

Enrichisseurs et table `code → enricher` (P2) · `TscTextSource` · `Ts7ApiSource` (P2.5) · serveur MCP · `human.ts` · README · Changesets · les bras modèle B1/B2 · Windows · project references / `tsc -b`.

Le serveur MCP reste bloqué par la porte de décision de PROJECT.md §7 : **pas avant les chiffres**. T7 est justement ce qui les produit.

---

## Comment rapporter en fin de parcours

La mesure obtenue, pas la mesure espérée. Dire explicitement ce qui a été laissé de côté et pourquoi, plutôt que de réduire le périmètre en silence.

Commit à chaque jalon terminé, sans demander. **Push sur `origin main` uniquement**, jamais sur une autre branche. Le miroir GitHub est géré par l'humain.
