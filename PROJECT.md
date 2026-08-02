# Handoff — Diagnostics TypeScript orientés agent

**Statut :** **P0 + B0 livrés le 2026-07-27.** Contrat de sortie et modèle de données arrêtés. Prochain jalon : **P1, la causalité** — voir §5.1 et §8, et les chiffres de base dans `EVAL.md`
**Licence cible :** MIT
**Nom :** `tssift` — *figé le 2026-07-27. Disponibilité npm vérifiée (404 registry).*
**Plan d'exécution :** `.plans/2026-07-27_p0-b0.md`

---

## 1. Thèse

`tsc` produit des diagnostics conçus pour un humain dans un éditeur, qui voit le survol de type, la navigation vers la déclaration et le contexte du fichier. Un agent qui exécute `tsc --noEmit` dans un shell ne dispose d'aucun de ces éléments : il reçoit un mur de texte plat, non hiérarchisé, où les symptômes et les causes ont exactement le même poids visuel.

Le projet produit une couche de post-traitement qui restructure ces diagnostics pour un consommateur machine.

### Deux hypothèses, de solidité très inégale

| # | Hypothèse | Confiance | Statut |
|---|---|---|---|
| **H1** | Réduire le bruit en cascade (40 diagnostics → 3 causes racines) diminue les faux départs et le coût en tokens | **Forte** — gain mécanique, mesurable trivialement | À exploiter en priorité |
| **H2** | Reformuler le message en prose actionnable améliore le taux de correction au premier essai | **Faible** — les modèles actuels lisent déjà correctement `tsc` | À valider par l'éval, pas à présumer |

**Conséquence directe sur l'ordre de construction :** H1 d'abord. H2 uniquement sur les codes où l'éval montre un gain. Ne pas inverser.

Cette phrase a une traduction mécanique, et c'est elle qui la rend opposable : **le renderer n'altère jamais le message TS** (§6). Un rapport qui reformule dès P0 ferait varier le bras B sur deux axes à la fois — regroupement et formulation — et l'éval ne pourrait plus attribuer l'écart ni à l'un ni à l'autre. H2 dispose d'un champ réservé, `restated`, vide jusqu'à ce que B2 le justifie code par code.

---

## 2. Non-objectifs

Explicitement hors périmètre, à défendre contre le glissement :

- ❌ **Ne pas prescrire de correctif.** L'outil ne dit jamais « va dans le fichier C et ajoute X ». Il ne sait pas si la faute est à l'appel ou à la déclaration. Un outil déterministe qui affirme un fix erroné est **pire** qu'un message vague : le modèle le suivra sans le questionner. On fournit des **faits localisés**, le modèle décide.
- ❌ Pas de correction automatique (pas de codefix, pas de `--fix`).
- ❌ Pas de remplacement de `tsc`. On consomme sa sortie, on ne réimplémente rien.
- ❌ Pas de rendu esthétique pour humain en V1 (`pretty-ts-errors` occupe déjà ce terrain).
- ❌ Pas de support ESLint / autres linters en V1.
- ❌ Pas de produit payant. Le marché est minuscule et l'utilisateur final est un agent.

---

## 3. Architecture

Contrainte structurante — **ce n'est plus un risque à moyen terme, c'est l'état du registre.** Vérifié le 2026-07-27 : `npm view typescript dist-tags` donne `latest: 7.0.2`. Le paquet `typescript@7` (port Go) n'exporte plus que `./lib/version.cjs` : **ni `ts.createProgram`, ni `ts.TypeChecker`, ni binaire `tsserver`.** `6.0.0-beta` est la dernière lignée en implémentation JS, `5.9.3` la dernière stable.

Ce que TS 7 offre à la place : un client IPC **synchrone** vers le binaire Go, sous `typescript/unstable/sync` — `new API()` → `updateSnapshot()` → `Snapshot.getProject()` → `{ program, checker }`. `Program.getSemanticDiagnostics()` existe, et le `Checker` expose `getPropertiesOfType`, `getSymbolAtPosition`, `typeToString`, `getResolvedSignature`, `getDeclaredTypeOfSymbol` — soit tout ce dont les enrichisseurs de §5.2 ont besoin. Deux réserves : le chemin est préfixé `unstable/` et peut casser entre mineures de 7.x, et chaque appel au checker est un aller-retour IPC, donc l'enrichissement y a un budget de latence qu'il n'a pas en 5.x.

Le `Diagnostic` de TS 7 est aussi plus pauvre que celui de 5.x : `{ fileName?, pos, end, code, category, text, messageChain?, relatedInformation? }` — des offsets bruts, aucun objet `SourceFile`. **C'est cette forme-là, la plus contrainte, qui dicte le modèle §4** : ce qu'on capture doit être exprimable dans les deux API, sinon `Ts7ApiSource` imposera de réécrire le pipeline au lieu de s'ajouter à côté.

Conséquence de cadrage, tranchée le 2026-07-27 : **V1 lit TS 5.4 → 5.9 via `TsApiSource`**, `typescript` en peer `>=5.4 <6`. Sur un projet en TS 6 ou 7, le CLI **ne dégrade pas** : il sort en code 2 avec un message nommé (§9). `Ts7ApiSource` est un jalon explicite, additif, avant la DoD v0.1.0.

```
┌─────────────────────────────────────────────────────────┐
│  SOURCES (interchangeables, derrière une interface)     │
│                                                         │
│  • TsApiSource    → TS 5.4–5.9 · createProgram + Checker│
│  • Ts7ApiSource   → TS 7 · typescript/unstable/sync     │
│  • TscTextSource  → parse de la sortie tsc (fallback)   │
└──────────────────────┬──────────────────────────────────┘
                       │  NormalizedDiagnostic[] + ProgramFacts
                       ▼
┌─────────────────────────────────────────────────────────┐
│  PIPELINE (le cœur, agnostique de la source)            │
│                                                         │
│  1. dedupe        identité stable, suppression doublons │
│  2. causality     détection racine / dérivé, graphe     │
│  3. group         regroupement par symbole & déclaration│
│  4. enrich        enrichisseurs par code d’erreur       │
│  5. budget        troncature sous contrainte de tokens  │
└──────────────────────┬──────────────────────────────────┘
                       │  DiagnosticReport
                       ▼
┌─────────────────────────────────────────────────────────┐
│  RENDERERS                                              │
│  • agent-text (défaut)  • json  • human                 │
└─────────────────────────────────────────────────────────┘
```

Règle d'or : **le pipeline ne voit jamais le `TypeChecker`.** Tout ce dont il a besoin est capturé à l'ingestion, par la source, sur **deux canaux** :

1. **Par diagnostic** — `NormalizedDiagnostic.context` : `subject`, `expected`, `actual`, résolus par la source. La capture est **sélective** : la source reçoit la liste des codes pour lesquels résoudre un contexte vaut la peine, sinon un monorepo paie 10 000 allers-retours de checker pour rien.
2. **Par programme** — `ProgramFacts`, retourné à côté du tableau : graphe de modules, liste de fichiers. Ce canal n'est pas décoratif : *« 2307 ⇒ tout ce qui importe ce module est dérivé »* (§5.1) est une affirmation sur le graphe de modules, et elle n'est déductible d'aucun `NormalizedDiagnostic[]`, si riche soit chaque élément.

Les étages de `pipeline/` deviennent donc `(diagnostics, facts) => diagnostics` : toujours purs, toujours sans checker, toujours testables au snapshot.

Corollaire à ne pas contourner : une poignée passée au pipeline qui *encapsulerait* le checker — même en lecture seule, même avec une liste blanche de méthodes — viole cette règle sur le fond. Elle rend la bascule TS 7 destructrice pour le pipeline et pas seulement pour la source. C'est exactement l'échappatoire que la règle existe pour interdire.

---

## 4. Modèle de données

```ts
interface SourceSpan {
  file: string;        // relatif au dossier du tsconfig résolu, séparateurs POSIX
  line: number;        // 1-indexed
  column: number;      // 1-indexed
  endLine?: number;
  endColumn?: number;
  snippet?: string;    // ligne source, trim — capturée toujours, rendue jamais
}

interface RelatedInfo {
  span?: SourceSpan;   // optionnel : en TS 7 un related peut n'avoir aucun fileName
  message: string;     // le texte du related — c'est LUI l'information utile
  code?: number;
}

interface MessageChainNode {
  text: string;
  code: number;        // le code de la feuille n'est pas celui de la racine
  depth: number;       // parcours préfixe + profondeur = encodage sans perte de l'arbre
}

interface DiagnosticContext {
  subject?: SymbolRef; // le symbole en cause
  expected?: SymbolRef;// type attendu + son point de déclaration
  actual?: string;     // type fourni
}

interface NormalizedDiagnostic {
  id: string;                    // sha256(code|file|line|col|message), 12 hex — voir plus bas
  code: number;                  // ex. 2769
  category: 'error' | 'warning' | 'suggestion' | 'message';
  primary: SourceSpan;
  message: string;               // message TS brut, JAMAIS altéré (traçabilité)
  chain: MessageChainNode[];     // arbre messageText aplati, profondeur préservée
  related: RelatedInfo[];        // relatedInformation — souvent la vraie info utile
  context?: DiagnosticContext;   // rempli par la SOURCE, jamais par le pipeline (règle 4)
}

interface ProgramFacts {
  root: string;                  // dossier du tsconfig résolu, absolu
  files: string[];               // relatifs à root
  imports: Record<string, string[]>;  // fichier → spécificateurs tels qu'écrits
  typescript: { version: string; path: string };  // le compilateur réellement chargé
}

interface SymbolRef {
  name: string;
  kind: string;                  // 'interface' | 'function' | 'variable' | ...
  declaredAt: SourceSpan;
  memberNames?: string[];        // pour les types objet
  signature?: string;            // rendu texte du type, tronqué
}

interface EnrichedDiagnostic extends NormalizedDiagnostic {
  role: 'root' | 'derived';      // 'derived' = expliqué par autre chose — voir plus bas
  derivedFrom: string[];         // ids des diagnostics racines — VIDE si la cause n'est pas un diagnostic
  group?: string;                // id du DiagnosticGroup, absent s'il n'appartient à aucun
  facts: Fact[];                 // faits vérifiables, jamais d'impératif
  confidence: 'high' | 'low';    // low ⇒ on retombe sur le format natif
  restated?: string;             // H2 — vide tant que l'éval ne l'a pas justifié, code par code
}

type GroupCause =
  | { kind: 'declaration'; symbol: SymbolRef }   // symbol.declaredAt EST la clé du groupe
  | { kind: 'module'; specifier: string };       // TS2307 : le spécificateur non résolu EST la clé

interface DiagnosticGroup {
  id: string;                    // 12 hex de sha256 ; clé selon la branche :
                                 //   declaration → kind|file|line|column · module → module|specifier
  cause: GroupCause;
  members: string[];             // ids des membres, dans l'ordre du rapport — jamais moins de 2
}

interface DiagnosticReport {
  diagnostics: EnrichedDiagnostic[];  // TOUS, rien de retiré (règle 2)
  groups: DiagnosticGroup[];          // index de rendu, trié par pouvoir explicatif
}

interface Fact {
  kind: 'declaration' | 'near-match' | 'members' | 'overloads' | 'origin';
  text: string;
  span?: SourceSpan;
}
```

`message` reste toujours présent et intact. Si un enrichisseur échoue ou hésite (`confidence: 'low'`), on rend le format natif. **Dégrader vaut mieux qu'inventer.**

**Notes de champ — chacune a coûté une décision, ne pas les rouvrir sans raison neuve.**

- **`id`.** `sha256(code|file|line|col|message)`, 12 premiers caractères hex. 12 et pas 8 : 32 bits donnent ~1 % de collision interne sur un monorepo à 10 000 diagnostics, ce qui corromprait `derivedFrom` en silence. « Stable entre runs » veut dire **déterministe à entrée identique** — et rien de plus. Un `id` ne survit **ni** à une édition du source (la ligne bouge) **ni** à une montée de version TS (le message est reformulé). Si l'éval a besoin un jour d'une identité qui traverse les éditions, on ajoutera un `fingerprint` distinct, à ce moment-là et avec sa raison.
- **`related`.** Typé `SourceSpan[]`, il perdait le texte du related — c'est-à-dire précisément l'information que ce dépôt s'engage à ne pas perdre. En 2769 c'est là que vit « the last overload gave the following error » ; en 2345, « the expected type comes from property 'x' ». D'où `RelatedInfo`. Le `span` est optionnel parce qu'en TS 7 un related peut n'avoir aucun `fileName`.
- **`chain`.** Parcours préfixe + `depth` est un encodage **sans perte** d'un arbre ordonné : rien n'est cédé par rapport à un `children[]`, et les snapshots restent lisibles — ce qui compte, puisqu'un diff de snapshot doit se lire. Le `code` par nœud est indispensable : une chaîne 2769 se termine typiquement sur un 2345, et c'est ce code-là qui informe.
  **Précision arrêtée le 2026-07-27 à l'implémentation :** le nœud de tête est **exclu** de `chain`, qui commence donc à `depth: 1`. La tête vit déjà dans `message` et `code` ; l'inclure en `chain[0]` dupliquerait le message dans `json` et obligerait chaque renderer à sauter `depth: 0`. L'encodage reste sans perte, la racine étant connue. Vérifié sur `overload-mismatch` : un 2769 donne la suite de profondeurs `[1,2,1,2,1,2]` — un arbre **branchant**, trois frères 2772 portant chacun une feuille. C'est un témoin plus exigeant qu'une chaîne linéaire, et c'est ce qui rend le parcours préfixe non négociable.
- **`ProgramFacts.imports`.** **Corrigé le 2026-07-27 à l'implémentation.** Le commentaire disait « spécificateurs **résolus** » ; c'est la seule sémantique qui rende le champ inutilisable par son unique consommateur documenté. §5.1 dérive sur « le diagnostic est dans un fichier dont l'import du module non résolu par la racine a échoué » : un module en 2307 n'a par définition **aucune** résolution, donc une table des résolutions réussies ne peut pas dire qui l'importait. `imports` porte donc les **spécificateurs tels qu'écrits** (`"@acme/csv-writer"`, `"../types/user"`), ce qui répond exactement à la question posée. Collectés sans checker, par parcours des `import`/`export`/`import =` de chaque fichier — donc compatible règle 4.
- **`ProgramFacts.files`.** Les fichiers du programme **hors** libs TypeScript et hors `node_modules`, normalisés et triés. Sans ce filtre, un dépôt réel y verse des milliers d'entrées de `@types` que rien ne consomme, dans le champ même qui doit rester lisible en `json`.
- **`category`.** Quatre membres, comme `ts.DiagnosticCategory`. P0 n'ingère que `getPreEmitDiagnostics()`, donc `'suggestion'` reste vide : les suggestions sont du bruit d'éditeur, et le consommateur a lancé `tsc --noEmit`.
- **`context` et non `subject` sur `EnrichedDiagnostic`.** Remplir un `SymbolRef` exige le checker ; la règle 4 l'interdit au pipeline. Tel qu'écrit auparavant, **aucune couche n'avait le droit de peupler `subject`**. Le champ descend donc dans `NormalizedDiagnostic`, rempli par la source.
- **`snippet`.** Capturé systématiquement (le texte source est déjà en main, c'est gratuit), exposé en `json`, **jamais rendu en `agent-text`**. Qu'un extrait économise un `Read` à l'agent — donc des tokens au total malgré un rapport plus gros — est une question empirique ; l'éval la tranchera en variante `--snippets` plutôt que nous par supposition.
- **`SourceSpan.file`.** Relatif au dossier du tsconfig résolu, séparateurs POSIX, la racine étant imprimée une fois en tête de rapport. Les chemins hors racine sont normalisés : `<ts-lib>/lib.es5.d.ts` pour les libs TypeScript, suffixe `node_modules/…` depuis la racine de paquet la plus proche. Un chemin hors racine qui n'est ni l'un ni l'autre reste relatif à la racine, avec des `../` — ce qui ne fait fuiter aucun `/home/<user>/…` non plus. Sans quoi un snapshot embarque le chemin de la machine et la version de TS, et meurt en CI comme partout ailleurs.
  Cas limite tranché à l'implémentation : un diagnostic **sans fichier** (TS 7 l'autorise explicitement, et TS 5 en produit pour certains diagnostics globaux) porte `file: "<none>"`, `line: 1`, `column: 1`. Le sentinelle rejoint le vocabulaire de `<ts-lib>/…` ; `primary` reste obligatoire, donc le modèle ne bouge pas.
- **`restated`.** Le champ de H2. Il existe pour que le modèle de données n'ait pas à bouger le jour où l'éval justifie une reformulation sur un code donné. Il reste vide jusque-là.
- **`DiagnosticGroup` et `DiagnosticReport` — ajoutés le 2026-07-27 à l'implémentation de P1, sur une mesure.** Le modèle n'avait que `role` / `derivedFrom`, ce qui présuppose qu'une cascade a un **diagnostic** pour cause. Mesure sur les trois entrées de corpus et les trois fixtures : dans **100 % des groupes observés, aucun membre ne se trouve sur sa propre cause**. C'est mécanique et non accidentel — renommer un champ ou changer une arité laisse la déclaration parfaitement valide et casse tous ses *usages*. Il n'y a donc, en général, aucun diagnostic dont dériver. Élire un membre comme « racine » aurait mis un fichier de test en tête de rapport à chaque fois, ce qui contredit la seule promesse du produit : *le premier diagnostic lu doit être le plus explicatif*. D'où un groupe dont l'en-tête est une **déclaration**.
- **Pourquoi deux champs et non un.** `diagnostics` est le tableau **complet**, `groups` un **index de rendu par-dessus**. Ce ne sont pas des alternatives : c'est ce découpage qui rend « `--all` restitue tout » vrai **par construction** plutôt que par vigilance, puisque le déclassement devient une propriété du rendu et jamais de la donnée (règle 2). Un pipeline qui filtrerait le tableau ne pourrait plus le promettre.
- **`derivedFrom` vide sur un dérivé.** Assumé. Un `derivedFrom` non vide affirme « ce diagnostic-ci est expliqué par ce diagnostic-là » ; quand la cause est une déclaration saine, il n'existe aucun id honnête à y mettre, et en fabriquer un serait un lien vers une chose qui n'existe pas. C'est `group` qui porte le lien dans ce cas — le seul que le corpus produise aujourd'hui.

---

## 5. Le pipeline en détail

### 5.1 Détection de causalité — le composant à plus forte valeur

C'est ici que se joue H1. Heuristiques, par ordre de fiabilité :

**Racines quasi certaines** (un seul de ces diagnostics explique généralement des dizaines d'autres) :
- `2307` — Cannot find module → tout ce qui importe de ce module est dérivé
- `2304` — Cannot find name
- `2503` / `2686` — namespace introuvable
- Toute erreur dans un fichier `.d.ts` ou dans un `index.ts` de barrel

**Règles de dérivation :**
1. Si un symbole `S` est déclaré `any` implicite ou inconnu à cause d'une racine `R`, tout diagnostic dont le `subject` est `S` est dérivé de `R`.
2. Deux diagnostics pointant vers la même `declaredAt` sont regroupés (même cause, sites d'usage différents).
3. Dans un même fichier, cascades de `2339` sur un même objet ⇒ une seule racine.
4. Plafond dur : au-delà de `N` diagnostics partageant une racine, on affiche les 3 premiers sites et un compteur `+37 autres usages`.

**Seuil de preuve — tranché le 2026-07-27, et c'est la décision qui protège la règle 2.**

On ne dérive **que sur un lien structurel présent dans les données capturées**, jamais sur une ressemblance :

- le diagnostic est dans un fichier dont l'import du module non résolu par la racine a échoué (via `ProgramFacts.imports`) ;
- ou il partage un `declaredAt` **identique** avec la racine ;
- ou son `context.subject` est le symbole que la racine a rendu irrésolvable.

Sont exclus : Levenshtein, « même identifiant », « même fichier + même code ». La règle 3 ci-dessus n'est donc **pas** appliquée telle quelle : « même nom dans le même fichier » n'est pas une identité — deux liaisons distinctes qui s'ombrent portent le même nom, et c'est exactement le mode de défaillance que §11 classe *critique*.

L'asymétrie est assumée : sous-regrouper coûte une part du chiffre de H1, sur-regrouper cache une vraie erreur derrière un compteur et produit l'édition-du-mauvais-fichier que la métrique « faux départ » existe pour détecter. **On desserrera plus tard avec des chiffres ; on ne resserre pas après un raté.** Attendre donc un sous-regroupement systématique sur les premières mesures : c'est le comportement voulu, pas un bug à corriger.

**Deux garde-fous ajoutés le 2026-07-27, à l'implémentation, et tous deux sortis de la mesure et non de la prudence.**

1. **Une déclaration hors des fichiers du programme ne peut pas être une cause.** `<ts-lib>/…` et `node_modules/…` sont refusés ; `ProgramFacts.files` fait autorité, plutôt qu'un test de préfixe sur le chemin. Ce n'est pas une précaution théorique : sur `.corpus/lekes-result-value-renamed`, un TS2345 résout son type attendu vers `<ts-lib>/lib.es2015.collection.d.ts` — `interface Map`. Sans ce garde-fou, deux bugs parfaitement indépendants fusionneraient dès que tous deux appellent mal une méthode de `Map`. C'est le mode de défaillance que §11 classe *critique*, et il était **déjà dans les données** avant qu'une seule ligne de causalité soit écrite. La capture, elle, reste : elle est vraie, et un enrichisseur de P2 la voudra. C'est la **dérivation** qui la refuse.
2. **Un groupe compte au moins deux membres.** Un groupe d'un seul est un en-tête sans rien de plié dessous : du bruit, et une entrée de plus dans le compte même sur lequel H1 se mesure.

**La règle 2307 est écrite depuis le 2026-07-28 (T1 de B1).** Elle plie les TS2307 **par spécificateur non résolu**, lu dans le message verbatim et recoupé avec `ProgramFacts.imports[fichier]` — le recoupement est le garde de correction : un spécificateur que la table d'imports ne porte pas (gabarit de message dérivé, spécificateur relatif, forme que `collectImports` ne parcourt pas) laisse le diagnostic en racine isolée plutôt que de risquer une fusion. `ProgramFacts.imports` porte **tous** les spécificateurs tels qu'écrits, résolus ou non — `{"src/callback.ts":["qs"]}` sur `phantom-dependency-pnpm`, dont le module ne résout précisément pas ; le champ était là depuis P0. Résultat mesuré : `phantom-dependency-pnpm` 3 → 1, `yarn-pnp-project` 3 → 1, `wrong-tsconfig-paths` 4 → **2** (une entrée par spécificateur), et le TS2307 solitaire de `two-independent-roots` reste racine sous le minimum de deux membres. Ce que les trois fixtures ont appris sur la forme de la règle, et qu'aucun raisonnement à sec n'avait donné :

- **La cascade est *de* 2307, pas *depuis* un 2307.** Un import non résolu donne `any` aux liaisons importées, ce qui n'émet plus rien en aval : sur les trois fixtures, tout diagnostic est un 2307, aucun n'est un dérivé d'autre chose. La règle plie donc des 2307 entre eux, et non « les erreurs des fichiers qui importent ».
- **La clé est le spécificateur, jamais le fichier.** `src/api-client.ts` de `phantom-dependency-pnpm` importe `@acme/http`, qui résout, **et** `qs`, qui ne résout pas. `imports[file]` seul ne dit pas lequel a échoué ; le message du diagnostic nomme le spécificateur en échec (`Cannot find module 'qs' …`), et ce nom, recoupé avec `imports[file]`, donne la clé. Une règle indexée sur le fichier regrouperait sur le mauvais module dès qu'un fichier a deux imports.
- **Grouper tous les 2307 ensemble serait un sur-regroupement.** `wrong-tsconfig-paths` en porte trois sur `@domain/order` et un sur `@domain/customer`. Une cause unique en amont, certes — la ligne `paths` — mais elle n'est dans aucun fichier du programme, donc rien dans les données capturées ne la nomme. La règle doit sortir deux entrées et non une.

**TS2305 n'a besoin de rien de tout cela** : son module *résout*, donc c'est déjà un cas de `declaredAt` identique — 12/12 sur le corpus. 2305 et 2307 se ressemblent dans le message et pas du tout dans la structure.

**Et la réponse est non — tranchée le 2026-07-28 par contre-exemple.** `fixtures/assignability-mismatch` a pour cause une union qui a perdu un membre, à `src/pricing/currency.ts:6`. Deux de ses trois diagnostics portent un `related`, et il désigne `currency.ts:9:3` — la **propriété** `Rate.currency`, du code correct que le lecteur ne doit pas modifier. Le troisième n'en porte aucun. Une règle indexée sur le `related` regrouperait donc deux tiers de la cascade **en tête d'une ligne qui n'a pas besoin d'être éditée**, et laisserait le reste dehors : la misdirection que §11 classe critique, en plus discret que la fusion de deux bugs. **Un `related` pointe là où le compilateur a jugé utile d'expliquer *ce* diagnostic, ce qui n'est pas la cause.** La règle n'est donc pas non prouvée : elle est fausse, et un test nommé la garde.

**Quelle fixture, précisément — la réponse a changé le 2026-07-27.** Cette règle a longtemps été rattachée à `broken-barrel-export`, la quatrième fixture de contrat. C'était une erreur de rangement : **un barrel qui cesse de réexporter un symbole résout parfaitement** — le fichier existe, le module se charge, seul le membre manque — et produit donc du 2305/2724, l'exact opposé d'un 2307 où *rien* ne résout. Les fixtures qui exercent la règle sont les trois fixtures de configuration/installateur qui portent des cascades 2307 : `wrong-tsconfig-paths`, **dépendance fantôme sous pnpm** et **projet Yarn PnP sans `node_modules`**. La règle 2307 est une règle de **causalité** (P1/T1), distincte de l'enrichisseur 2307 de P2 qui, lui, ajoutera les faits sous l'en-tête.

**Un troisième garde-fou, sorti de la même fixture : deux codes peuvent décrire une seule panne, et lequel sort dépend des noms.** TypeScript émet **2724** (`… Did you mean 'Z'?`) plutôt que 2305 dès qu'un nom proche existe parmi les exports réels du module. `broken-barrel-export` n'émet que du 2724, uniquement parce que `Order` voisine `OrderId`. Les deux codes sont donc capturés, par le même resolver et vers la même forme (`src/codes.ts`) — sans quoi une cascade identique plierait ou non selon l'orthographe choisie par l'auteur du code analysé.

**Ordre de sortie :** racines d'abord, triées par nombre de dérivés décroissant. Le premier diagnostic lu par l'agent doit être le plus explicatif.

**Déclassement — ce que « déclasser » veut dire concrètement.** Un dérivé perd sa ligne de message dans le rapport par défaut et survit comme une position dans la liste `N derived:` de sa racine. Le plafond affiche trois sites puis un compteur. `--all` restitue chaque diagnostic en ligne pleine, sans regroupement. **Rien n'est jamais retiré du tableau — seulement du rendu** (règle 2).

### 5.2 Enrichisseurs — table `code → enricher`

Périmètre V1, par ordre de rentabilité :

| Code | Message TS | Rentabilité | Ce qu'on ajoute |
|---|---|---|---|
| **2769** | No overload matches this call | ⭐⭐⭐ | Liste des surcharges + laquelle échoue le plus tard, et sur quel argument. Illisible pour tout le monde. |
| **2345** | Argument type not assignable | ⭐⭐⭐ | Déclaration du paramètre, forme des deux types, premier champ divergent |
| **2339** | Property does not exist | ⭐⭐ | Déclaration du type, liste des membres réels, candidat proche (Levenshtein) |
| **2353** | Object literal may only specify known properties | ⭐⭐ | Idem 2339 + position de la déclaration de l'interface |
| **2322** | Type not assignable | ⭐⭐ | Chemin de divergence dans le type (`a.b[0].c`), pas le type entier |
| **2307** | Cannot find module | ⭐⭐ | Distingue : paquet absent de `package.json` / chemin cassé / types manquants / mauvais `paths` / **dépendance non déclarée sous installateur strict**. Ces distinctions dépendent du gestionnaire de paquets — voir §9.1. |
| **2554** | Expected N arguments, got M | ⭐ | Signature déclarée + sa position |
| **2739/2741** | Missing properties | ⭐ | Liste exacte des manquants, sans le reste du type |
| **18047/18048** | Possibly null / undefined | ⭐ | Origine de la nullabilité (où le type devient optionnel) |
| **2551** | Did you mean X | ⭐ | Déjà bon nativement — surtout ne pas dégrader |

Les codes hors table sortent au format natif. **Couvrir 10 codes bien vaut mieux que 60 à moitié.**

**Ce que P2 a livré le 2026-08-01, et où cette table s'est trompée.** Six codes ont un enrichisseur — **2339, 2353, 2345, 2554, 2305, 2724** — sélectionnés par une règle unique : *un enrichisseur sort quand le fait qu'il produit est déjà capturé et que TypeScript ne l'imprime pas déjà.* Quatre entrées ci-dessus ne sortent pas, et une cinquième sort en no-op ; les chiffres sont dans `EVAL.md` § P2.

- **2769, classé ⭐⭐⭐ ici, est en réalité le moins rentable des dix.** Toute sa charge utile est déjà dans `chain` — TypeScript imbrique un TS2772 par candidat avec sa signature et l'erreur qui l'a tué, et le renderer l'imprime depuis P0. « Laquelle échoue le plus tard » **n'est pas dérivable** du capturé : sur `overload-mismatch`, les trois branches ont même profondeur et une feuille chacune.
- **2322, 2307 et 18047/18048 manquent de données, pas de code.** 2322 demanderait les deux types comme structures, 2307 la topologie installée — donc un canal `ProgramFacts` neuf, un étage de pipeline n'ayant pas le droit de lire des fichiers (règle 4) — et 18047 une analyse de flot.
- **2551 est absent de la table par décision** : il est déjà bon nativement, et l'instruction de ne pas le dégrader se respecte le mieux en ne le touchant pas.
- **Le « candidat proche (Levenshtein) » de 2339 n'existe pas, sur mesure.** TypeScript émet TS2551/TS2724 *à la place de* TS2339/TS2305 dès que son correcteur trouve un candidat : tout diagnostic parvenant à un enrichisseur est un cas qu'il a déjà rejeté. À seuil comparable, une suggestion se déclenchait 38 fois sur les fixtures et le corpus, sur deux noms, et était fausse les deux fois (`kind` → `id`, `side` → `id`, sur la cascade qui résiste déjà à 100 % en B1). Aucun `Fact` de type `near-match` n'est produit, et un test le garde.

Cette table a un second usage, moins visible : **c'est elle qui pilote la capture sélective de `context`** (§3). La source reçoit la liste des codes pour lesquels résoudre un `SymbolRef` vaut son aller-retour de checker ; tout le reste est ingéré sans contexte. La liste est déclarative et partagée — la source ne connaît pas les enrichisseurs, seulement des numéros.

### 5.3 Budget de tokens

**Jalon : P1, pas P0.** §8 listait `--budget-tokens` dans le CLI de P0 alors que la troncature qui l'honore arrive en P1. Un drapeau qui se parse et ne fait rien est un mensonge avec un numéro de version : le drapeau n'apparaît qu'avec son implémentation.

Le renderer accepte `--budget-tokens`. Stratégie de troncature, dans cet ordre :
1. Types longs → forme abrégée (`{ id, email, name?, ...12 autres }`)
2. Sites d'usage dérivés → compteur
3. Diagnostics à faible rang → `+N erreurs supplémentaires, relancer avec --all`

Ne jamais tronquer une racine.

---

## 6. Format de sortie

*Les deux blocs ci-dessous sont la **sortie réelle** de `fixtures/partial-interface-rename/before` sous TypeScript 5.9.3, relevée le 2026-07-27 et figée dans `test/__snapshots__/render.test.ts.snap`. La version antérieure de cette section était écrite à la main : elle montrait des numéros de ligne inventés et un enchaînement 2353 en chaîne du 2345 que le compilateur ne produit pas. Si ces blocs et le snapshot divergent un jour, c'est le snapshot qui a raison, et cette section se corrige.*

### Avant (`tsc --noEmit`)

```
fixtures/partial-interface-rename/before/src/api/user.ts(10,5): error TS2353: Object literal may only specify known properties, and 'emailAddress' does not exist in type 'CreateUserInput'.
fixtures/partial-interface-rename/before/src/api/user.ts(16,16): error TS2339: Property 'emailAddress' does not exist on type 'CreateUserInput'.
fixtures/partial-interface-rename/before/src/api/user.ts(30,11): error TS2345: Argument of type '{ id: string; emailAddress: string; }' is not assignable to parameter of type 'CreateUserInput'.
  Property 'email' is missing in type '{ id: string; emailAddress: string; }' but required in type 'CreateUserInput'.
```

### Après — P0 (renderer `agent-text`, sans causalité ni enrichissement)

```
root: fixtures/partial-interface-rename/before
3 errors · 1 file

[1] src/api/user.ts:10:5 error TS2353: Object literal may only specify known properties, and 'emailAddress' does not exist in type 'CreateUserInput'.

[2] src/api/user.ts:16:16 error TS2339: Property 'emailAddress' does not exist on type 'CreateUserInput'.

[3] src/api/user.ts:30:11 error TS2345: Argument of type '{ id: string; emailAddress: string; }' is not assignable to parameter of type 'CreateUserInput'.
      TS2741: Property 'email' is missing in type '{ id: string; emailAddress: string; }' but required in type 'CreateUserInput'.
    related src/types/user.ts:9:3: 'email' is declared here.
```

Le gain visible à ce stade est mince, et c'est attendu (voir plus bas) : les chemins sont raccourcis par la racine sortie en tête, la chaîne et le related sont étiquetés et positionnés — `related src/types/user.ts:9:3` est une information que `tsc` ne donne pas du tout en texte. Le pliage des cascades, lui, arrive en P1.

Un second témoin, `fixtures/overload-mismatch`, montre ce que le rendu de chaîne doit encaisser — un arbre **branchant**, trois surcharges candidates, chacune avec sa propre feuille, et trois related :

```
root: fixtures/overload-mismatch/before
1 error · 1 file

[1] src/transport/client.ts:4:10 error TS2769: No overload matches this call.
      TS2772: Overload 1 of 3, '(url: string, options: GetOptions): string', gave the following error.
        TS2322: Type '"POST"' is not assignable to type '"GET"'.
      TS2772: Overload 2 of 3, '(url: string, options: PostOptions): string', gave the following error.
        TS2820: Type '"exponentail"' is not assignable to type '"exponential" | "linear"'. Did you mean '"exponential"'?
      TS2772: Overload 3 of 3, '(url: string, options: StreamOptions): string', gave the following error.
        TS2322: Type '"POST"' is not assignable to type '"STREAM"'.
    related src/transport/request.ts:10:3: The expected type comes from property 'method' which is declared here on type 'GetOptions'
    related src/transport/request.ts:4:5: The expected type comes from property 'kind' which is declared here on type '{ kind: "exponential" | "linear"; ceilingMs: number; }'
    related src/transport/request.ts:22:3: The expected type comes from property 'method' which is declared here on type 'StreamOptions'
```

### Après — P1 (causalité)

*Sortie réelle de `fixtures/partial-interface-rename/before` sous 5.9.3, relevée le 2026-07-27 et figée dans le snapshot. Les trois diagnostics de P0 sont devenus **une** entrée.*

```
root: fixtures/partial-interface-rename/before
3 errors · 1 file · 1 root cause

[1] cause: interface 'CreateUserInput' declared at src/types/user.ts:7:1
    3 diagnostics, TS2339 · TS2345 · TS2353
    src/api/user.ts:10:5 error TS2353: Object literal may only specify known properties, and 'emailAddress' does not exist in type 'CreateUserInput'.
    src/api/user.ts:16:16 error TS2339: Property 'emailAddress' does not exist on type 'CreateUserInput'.
    src/api/user.ts:30:11 error TS2345: Argument of type '{ id: string; emailAddress: string; }' is not assignable to parameter of type 'CreateUserInput'.
        TS2741: Property 'email' is missing in type '{ id: string; emailAddress: string; }' but required in type 'CreateUserInput'.
      related src/types/user.ts:9:3: 'email' is declared here.
```

Sur une vraie cascade, au-delà du plafond de trois sites — `.corpus/lekes-ok-arity-changed`, **153 diagnostics rendus en 2 entrées** :

```
root: .corpus/lekes-ok-arity-changed
153 errors · 31 files · 1 root cause

[1] cause: function 'ok' declared at src/shared/domain/result.ts:15:19
    152 diagnostics, all TS2554
    src/features/agents/application/agent-runner.service.test.ts:52:20 error TS2554: Expected 2 arguments, but got 1.
      related src/shared/domain/result.ts:15:33: An argument for 'origin' was not provided.
    src/features/agents/application/agent-runner.service.test.ts:53:24 error TS2554: Expected 2 arguments, but got 1.
      related src/shared/domain/result.ts:15:33: An argument for 'origin' was not provided.
    src/features/agents/application/agent-runner.service.test.ts:54:22 error TS2554: Expected 2 arguments, but got 1.
      related src/shared/domain/result.ts:15:33: An argument for 'origin' was not provided.
    +149 more sites (--all for every one)

[2] src/shared/domain/result.ts:15:90 error TS2353: Object literal may only specify known properties, and 'origin' does not exist in type '{ readonly ok: true; readonly value: T; }'.
```

**L'en-tête d'un groupe est une déclaration, pas un diagnostic — amendement du 2026-07-27, sur mesure.** La version antérieure de cette section montrait la forme inverse : un diagnostic en pleine ligne suivi de `2 derived: :58:12, :71:3`. Elle a été écrite avant que le corpus existe, et la mesure l'a infirmée : dans **100 % des groupes observés, aucun membre ne se trouve sur sa propre cause** (détail en §4). Appliquée à `ok-arity-changed`, cette forme aurait mis en tête `agent-runner.service.test.ts:52:20` — un fichier de **test** — et n'aurait **jamais nommé** `result.ts:15`, qui est la seule chose à lire. Un rapport qui trie par pouvoir explicatif ne peut pas taire l'explication.

**Un groupe TS2307 n'a pas de déclaration en tête — sa cause est un module absent (règle 2307, écrite le 2026-07-28).** Un import non résolu n'a aucune déclaration à nommer, alors l'en-tête nomme le **spécificateur** et s'arrête là — pas de `declared at`, puisqu'il n'y a rien où pointer :

```
root: fixtures/phantom-dependency-pnpm/before
3 errors · 3 files · 1 root cause

[1] cause: unresolved module 'qs'
    3 diagnostics, all TS2307
    src/api-client.ts:2:27 error TS2307: Cannot find module 'qs' or its corresponding type declarations.
    src/callback.ts:1:23 error TS2307: Cannot find module 'qs' or its corresponding type declarations.
    src/upload.ts:2:27 error TS2307: Cannot find module 'qs' or its corresponding type declarations.
```

La clé est le spécificateur, jamais le fichier : `wrong-tsconfig-paths` sort **deux** entrées, une par spécificateur (`@domain/order` plié à trois, `@domain/customer` seul et donc non plié), parce que regrouper deux alias distincts sous un seul en-tête serait le sur-regroupement que §11 classe critique.

### Après — P2 (les faits)

**Livré le 2026-08-01.** Ce que P2 ajoute sous l'en-tête de cause, tel qu'il sort réellement sur `fixtures/partial-interface-rename` :

```
[1] cause: interface 'CreateUserInput' declared at src/types/user.ts:7:1
      3 properties: id, email, name
    3 diagnostics, TS2339 · TS2345 · TS2353
    …
```

**La maquette qui figurait ici était fausse sur deux points, et les fixtures l'ont montré.** Elle est corrigée ci-dessus plutôt que conservée par égard pour l'intention.

- Elle montrait la **forme** du type (`{ id: string; email: string; name?: string }`). Ce rendu **n'existe pas pour un type nommé** : `checker.typeToString` d'une interface rend son nom, donc la ligne se serait lue `type 'CreateUserInput' CreateUserInput`. C'est la **liste des propriétés** qui porte l'information. La forme n'est rendue que là où elle n'est pas le nom — une signature résolue (`(action: string, actor: string): AuditEvent` sur TS2554), ou un type anonyme.
- Elle montrait un **`near match: 'email' (distance 2)`**. La distance réelle est 7, aucun near-match n'est produit sur aucun code, et §5.2 dit pourquoi : TypeScript émet TS2551/TS2724 à la place dès que *son* correcteur trouve un candidat, donc le nôtre ne pourrait se déclencher que là où le sien a dit non — mesuré, 38 déclenchements, faux tous.

Un fait d'économie à ne pas perdre : **les faits se rendent une fois par groupe, pas une fois par diagnostic.** Une cascade de 65 diagnostics repliée en une entrée porte une seule ligne de propriétés, ce qui est pourquoi P2 ne coûte que 40 à 85 caractères sur une cascade profonde (`EVAL.md` § P2). Sous `--all` il n'y a plus de groupe pour amortir, et chaque diagnostic reporte ses faits : c'est voulu, et c'est là que l'enrichissement est cher.

**Trois choses à ne pas défaire dans ce format.**

1. **Le message TS est brut, verbatim, toujours.** La version antérieure de cette section montrait un message reformulé — c'est H2, l'hypothèse que §1 classe *confiance faible* et interdit de présumer. Reformuler dès P0 ferait différer le bras B du bras A par le regroupement **et** la reformulation à la fois : plus aucune mesure ne pourrait attribuer l'écart, et H1 — l'hypothèse forte, celle qui justifie mécaniquement l'outil — deviendrait immesurable. H2 arrivera par `restated`, code par code, désactivé par défaut.
2. **La langue de sortie est l'anglais**, cadre compris. Le message TS est anglais et la règle 3 interdit de le traduire : un cadre français produirait un rapport bilingue. Et, là encore, le bras B ne doit différer du bras A que par la structure. La documentation projet, elle, reste en français.
3. **Une ligne par diagnostic, jamais de retour à la ligne.** Un message replié est plus dur à `grep` et son diff est illisible. Les nœuds de chaîne s'indentent selon `depth`, les related portent leur étiquette.

**Conséquence à assumer :** la sortie P0 est visiblement moins spectaculaire que l'exemple qui figurait ici. Ce sont les mêmes messages que `tsc`, ordonnés et annotés — le pliage des cascades n'arrive qu'en P1. C'est voulu, et c'est écrit ici pour que ça ne ressemble pas à un oubli dans trois semaines.

**`json` est le rapport complet ; `agent-text` en est une projection à perte,** jamais l'inverse. Les `id` sont en `json` seulement, les `[n]` en texte seulement, `snippet` en `json` seulement. Tout champ présent dans le texte existe en `json` avec le même sens. C'est `json` que consommera le serveur MCP.

---

## 7. Le harnais d'éval — non négociable

**Se construit en parallèle du moteur, pas après.** Sans chiffres, le projet est un formateur cosmétique de plus.

### Corpus

`fixtures/` — ~20 mini-projets, chacun :

```
fixtures/broken-barrel-export/
  ├── meta.json          # { rootCause, expectedFix, tags, difficulty }
  ├── before/            # projet cassé, compile pas
  └── after/             # état corrigé attendu
```

Catégories à couvrir : export de barrel cassé · renommage d'interface partiel · erreur de surcharge · générique mal contraint · module absent · nullabilité · union discriminée mal narrowée · import de type manquant · mauvais `paths` tsconfig · erreur en monorepo cross-package · **dépendance fantôme sous installateur strict (pnpm)** · **projet Yarn PnP, sans `node_modules`**.

**Les trois premières, écrites avant tout code moteur** (elles sont le contrat) : `partial-interface-rename` — c'est l'exemple de §6, donc le contrat y est déjà à moitié spécifié ; `two-independent-roots` — le témoin négatif, obligatoire ; `overload-mismatch` (2769) — le seul moyen réaliste d'avoir dès le premier jour une `messageChain` à trois niveaux et plusieurs `relatedInformation` dans un snapshot, or le rendu de chaîne se fige maintenant et a donc besoin d'un témoin maintenant. Elles arrivent en `meta.json` + `before/` seulement ; `after/` viendra quand un bras d'éval en aura besoin.

Faiblesse connue de ce trio : deux fixtures sur trois sont mono-fichier, donc le rendu des chemins inter-fichiers reste sous-testé jusqu'à `broken-barrel-export`, qui est la quatrième. **Elle est livrée le 2026-07-27** — trois modules importent le même symbole d'un barrel qui a cessé de le réexporter, et le rapport les plie en une entrée nommant `src/domain/index.ts:1:1`.

**Huit autres suivent le 2026-07-28, portant le corpus à douze.** Le second lot — `assignability-mismatch` (2322), `misspelled-property` (2551), `unconstrained-generic` (2536) et `value-used-as-type` (2749) — vise les deux derniers codes sans témoin de la table des dix, plus deux formes que rien ne couvrait : des diagnostics **sur** leur propre cause, et une cascade **sans aucun lien structurel**. Aucun des quatre ne plie, ce qui donne le chiffre à retenir : **sur les dix fixtures qui sont des cascades à cause unique, le seuil de §5.1 en plie quatre.** Le pliage tient à la liste de six codes de `src/codes.ts`, pas à une propriété générale des cascades. Détail et conséquences dans `EVAL.md`.

**Quatre de plus le même jour, portant le corpus à seize — et c'est le lot qui épuise les catégories de configuration.** `wrong-tsconfig-paths`, `monorepo-cross-package`, `phantom-dependency-pnpm` et `yarn-pnp-project` sont les quatre fixtures que la liste ci-dessus annonce comme déviant du bloc canonique, et les deux dernières portent une **arborescence installée commitée** : les liens symboliques `.pnpm` de pnpm, et un projet PnP sans le moindre `node_modules`. `node_modules/`, `pnpm-lock.yaml` et `yarn.lock` sont git-ignorés à la racine et réadmis sous `fixtures/` exprès — une fixture doit rester reproductible sans réseau et sans que pnpm ni yarn soient installés (§9.1). Une seule des quatre plie : `monorepo-cross-package` (4 → 1), et elle est la seule fixture dont la cause vit dans un **autre paquet** que tous ses diagnostics, ce qui exerce pour de vrai le garde-fou « déclaration hors des fichiers du programme » de §5.1 — un paquet frère n'est ni `<ts-lib>/…` ni `node_modules/…`, donc le garde-fou doit l'**admettre**. Les trois autres sont des TS2307 et ne pliaient pas, faute de la règle 2307 alors non écrite ; ce sont précisément les fixtures qui l'ont débloquée, et **elles plient depuis T1 (2026-07-28)** — `phantom` et `yarn-pnp` 3 → 1, `wrong-tsconfig-paths` 4 → 2.

**`yarn-pnp-project` est la seule fixture dont le `before/` ne contient aucun bug**, et c'est un témoin qui manquait. Le code y est correct, le paquet installé, déclaré et verrouillé ; les trois TS2307 sont l'artefact d'un compilateur lancé en processus Node nu, qui ne charge donc jamais la carte de résolution de `.pnp.cjs`. Conséquence à énoncer dans le README plutôt qu'à découvrir dans une issue : **tssift est lui-même un processus Node nu**, et produira exactement cette sortie sous PnP s'il n'est pas lancé au travers du runtime (`yarn tssift`).

**Quatre de plus le 2026-07-28, portant le corpus à vingt — la cible de §8 lot B, atteinte par T0 de B1, et le lot qui ferme la liste des catégories ci-dessus.** `missing-type-import` couvre la dernière catégorie sans témoin, « import de type manquant » : `verbatimModuleSyntax` activé et deux fichiers important des types avec un import de valeur, trois TS1484 sur un module qui résout parfaitement — le correctif est un mot-clé, pas une dépendance, donc ce n'est en rien un TS2307. Les trois autres sont libres et chacune comble un trou que la mesure rendait visible : `cannot-find-name` produit la première cascade de TS2304, que §5.1 classe **racine quasi certaine** au même titre que 2307 et qu'aucune fixture n'exerçait (le seuil n'avait vu que la moitié de sa liste de racines) ; `missing-multiple-properties` est le jumeau multi-membres de `missing-required-property`, le témoin qui manquait à TS2739 ; et `two-roots-one-file` est le **témoin négatif dur**, deux causes indépendantes dans un seul fichier sous un seul code (TS2339) — le cas où le sur-regroupement est le plus tentant. Le moteur y rend `4 errors · 1 file · 2 root causes` : il plie les deux diagnostics de chaque interface mais tient les deux causes à part, parce qu'il indexe sur `declaredAt` et non sur fichier + code, et un test nommé le garde. Aucune des quatre n'introduit un code capturé, donc le pliage à cause unique était à **5 sur 17** à leur arrivée ; elles sont commitées pour que ce que le seuil refuse soit un chiffre. *(T1, le même jour, a porté ce rapport à **8 sur 17** en écrivant la règle 2307 — §5.1 et EVAL.md.)*

**Premier lot du même jour** — premier morceau de B1, qui en demande vingt : `arity-changed` (2554), `narrowed-union-member` (2339 sur un alias d'union), `nullable-chain` (18047) et `missing-required-property` (2741). Les deux premières plient ; **les deux dernières non, délibérément**, leurs codes n'étant pas capturés. Elles sont commitées pour que ce que le seuil de §5.1 refuse soit un chiffre — 128 % et 169 % de caractères — plutôt qu'une intuition. `arity-changed` comble en outre un trou gênant : TS2554 est la plus grosse cascade jamais mesurée (152 diagnostics pliés en une entrée) et ne vivait que dans `.corpus/`, git-ignoré et dérivé d'un dépôt privé — un clone frais ne pouvait pas reproduire la meilleure preuve de H1.

**`broken-barrel-export` a été construite pour plier, et ce n'est pas une facilité.** Retirer un export d'un barrel *réel* (`lekes`) n'a produit aucune cascade : ses onze importateurs consommaient chacun un symbole différent, donc onze diagnostics indépendants. Une fixture de barrel dont les consommateurs divergent ne teste rien du regroupement ; celle-ci fait donc converger trois consommateurs sur un symbole. Ce que la mesure du dépôt réel dit en creux — **une cascade de barrel n'est pas automatique** — est noté ici pour ne pas être relu comme une sur-promesse du rendu.

**Configuration d'une fixture.** Chaque `before/` porte son propre `tsconfig.json` **complet**, sans `extends` sortant du dossier — parce que le bras A est un modèle qui lance `tsc --noEmit` dans une *copie* de `before/`, et qu'une copie doit rester exécutable. Bloc canonique, dupliqué tel quel : `strict`, `noEmit`, `skipLibCheck`, `target: ES2022`, `lib: ["ES2022"]` (pas de DOM : moins de globaux ambiants, plus de déterminisme), `module: ESNext`, `moduleResolution: Bundler`. Deux pièges évités par ce choix : `NodeNext` exigerait une extension `.js` sur chaque import relatif et couvrirait les fixtures de TS2835, et `skipLibCheck` laissé à son défaut ferait entrer du bruit `@types` dans les snapshots. Les fixtures dont le sujet **est** la configuration — mauvais `paths`, monorepo, pnpm, PnP — dévient délibérément et le disent dans `meta.json`, champ **`deviatesFromCanonicalConfig`** : la déviation y est nommée ligne à ligne, sans quoi un lecteur ne peut pas distinguer un écart voulu d'une fixture écrite de travers.

### Protocole

Pour chaque fixture, deux bras : **A** = `tsc --noEmit` brut, **B** = sortie enrichie. Même modèle, même prompt, même budget de tours, `n=5` runs par fixture (variance non négligeable).

**Deux étages, et le premier n'appelle aucun modèle.**

**B0 — mesure déterministe, gratuite, immédiate.** Le contenu annoncé de B0 est *« harnais de run, métrique tokens »*, et la métrique tokens n'a besoin d'aucun modèle : c'est la taille de la sortie A comparée à la sortie B. B0 rapporte, par fixture et par dépôt réel : nombre de diagnostics A vs B, nombre de **caractères** A vs B, et une estimation de tokens dérivée en `chars / 4`, **diviseur annoncé dans EVAL.md**. Le caractère est le primitif publié parce que n'importe qui peut le reproduire sans faire confiance à notre tokenizer, et parce que le **rapport** A/B — qui est la revendication réelle — est quasi indépendant du tokenizer. Aucune dépendance, aucune clé d'API. Premier chiffre de H1 dans la même semaine que P0, sur les fixtures **et** sur des dépôts réels (`~/projects/lekes` en TS 5.7, `~/projects/tccp` en TS 5.5, plus ce qui qualifie dans `~/projects/nextp/*`).

**B1 / B2 — bras modèle, harnais maison.** Une boucle d'agent minimale sur l'API Messages, trois outils que nous implémentons : `read_file`, `write_file`, `run_typecheck`, sur une copie de la fixture, prompt fixe, plafond de tours dur. Chaque métrique en tombe exactement : les tokens depuis `usage`, les tours depuis le compteur de boucle, **les faux départs depuis les appels `write_file` que nous interceptons déjà**, les régressions depuis un typecheck final. Reproductible par un tiers à partir d'EVAL.md seul, et stable dans le temps parce que rien du harnais ne bouge sous nos pieds. Modèle : un modèle de classe Sonnet — représentatif d'une boucle d'agent réelle, moins cher à `n=5`, et plus sensible aux tokens qu'un modèle de classe Opus, donc H1 y est mesuré là où il mord. Coût du balayage complet (20 × 2 × 5 = 200 runs) : quelques dizaines de dollars ; vérifier les tarifs au moment de le lancer plutôt que de les citer de mémoire.

### Métriques

| Métrique | Ce qu'elle teste | Étage |
|---|---|---|
| Diagnostics affichés, A vs B | H1, gain mécanique | B0, sans modèle |
| Caractères de sortie, A vs B (+ estimation `chars/4`) | H1, gain mécanique | B0, sans modèle |
| Taux de correction au 1er essai | H2 | B1+ |
| Nombre de tours avant `tsc` vert | H1 + H2 | B1+ |
| Taux de « faux départ » (édition d'un fichier non impliqué) | H1, le cœur | B1+ |
| Régressions (fix qui casse autre chose) | garde-fou | B1+ |

### Porte de décision

**Aucun travail sur le serveur MCP ni sur des codes supplémentaires avant d'avoir ces chiffres.** Si H1 se confirme et H2 non : on assume, on documente, l'outil devient « un dédupliqueur de diagnostics » et c'est très bien. C'est un positionnement honnête et le README en sera meilleur.

---

## 8. Roadmap

Deux lots en parallèle. Le lot B n'est pas optionnel.

### Lot A — moteur

**P0 · Squelette (~1 semaine)**
- 3 fixtures (`meta.json` + `before/`), vérifiées échouant réellement sous 5.4.5 **et** 5.9.3
- `TsApiSource` : résolution du `typescript` **du projet analysé**, garde de version, `createProgram` + `getPreEmitDiagnostics`, marche du `messageChain`, capture des `relatedInformation`, capture sélective de `context`, `ProgramFacts`
- Normalisation + `id` déterministe
- Renderers `agent-text` et `json` sans enrichissement
- CLI : `tssift [--project tsconfig.json] [--format agent-text|json] [--all]`, sorties 0 / 1 / 2
- Tests snapshot (sur 5.9.3) + invariants tolérants (autres cellules de matrice)

**P1 · Causalité (~1 semaine)** — *le vrai livrable*
- Détection racine/dérivé sur liens structurels uniquement, graphe, regroupement, plafonds
- Tri par pouvoir explicatif
- Budget de tokens **et** le drapeau `--budget-tokens` qui l'expose

**P2 · Enrichissement**
- Table `code → enricher`, top 5 codes uniquement
- `confidence: low` ⇒ repli sur natif

**P3 · Distribution** — *conditionné aux chiffres de l'éval*
- Serveur MCP exposant `typecheck` (sortie JSON structurée). **La case n'est plus vide** : `ts-diagnostics-mcp` l'occupe depuis 2025-10, sur un angle que nous ne traitons pas (cache partagé entre agents concurrents). À rouvrir avec cette information le jour où les chiffres autorisent P3 — voir §10
- `npx tssift` sans installation
- README avec les métriques en tête

**P2.5 · `Ts7ApiSource`** — *jalon explicite, avant la DoD v0.1.0*
- `typescript/unstable/sync` derrière la même interface `DiagnosticSource`
- Peer élargi, garde de version levée pour 7.x
- Cellule CI dédiée ; le job « TS 7 ⇒ sortie 2 » est remplacé par un job de parité

**P4 · Optionnel**
- Plugin Language Service (confort éditeur, pas le cas d'usage cible)
- Mode watch / incrémental

### Lot B — éval

- **B0** (avec P0) : mesure déterministe, **sans modèle** — diagnostics et caractères A vs B, sur les 3 fixtures et ≥ 3 dépôts réels
- **B1** (avec P1) : 20 fixtures, harnais d'agent maison, les métriques modèle, baseline A mesurée
- **B2** (avec P2) : bras B mesuré, arbitrage H2 code par code

---

## 9. Stack

| Choix | Décision | Note |
|---|---|---|
| Toolchain (local) | **mise** | `mise.toml` à la racine, node et bun épinglés. **Dev uniquement — la CI ne le lit pas** |
| Runtime cible | **Node ≥ 20.19** | `engines.node: ">=20.19"`. Pas « ≥ 20 » : la sortie est ESM seule, et `require()` d'un module ESM n'existe que depuis 20.19. Promettre 20.0 serait une promesse intenable |
| Langage | TypeScript strict | |
| Gestionnaire de paquets (dev) | **bun** | `bun install`, `bun run`. Choix interne, sans effet sur les consommateurs |
| Build | **`tsc`, aucun bundler** | ESM seul + `.d.ts` + `bin`. Voir ci-dessous : il n'y a rien à empaqueter |
| Tests | Vitest, snapshots | exécuté **sous Node**, pas `bun test` — voir ci-dessous |
| Lint/format | Biome | |
| Releases | Changesets | |
| Repo | Mono-package d'abord | Split `core` / `cli` / `mcp` seulement si nécessaire |
| CI | GitHub Actions | trois axes séparés + un job de garde TS 7, Ubuntu seul — voir ci-dessous |
| Peer dep | `typescript`, **`>=5.4 <6`** | jamais bundlé. Résolu depuis le projet analysé, pas depuis notre installation |

**Le build : pas de bundler du tout.** La décision ouverte `tsdown` vs `tsup` se dissout plutôt qu'elle ne se tranche. Le paquet vise **zéro dépendance runtime** (`typescript` est un peer, jamais empaqueté) ; or le travail d'un bundler est d'inliner des dépendances et de réécrire des formats. Sans rien à inliner, `tsc` émet déjà de l'ESM correct et les déclarations, et il **préserve le shebang `#!/usr/bin/env node`** dont dépend la délégation de bun vers Node. Reste le format CJS comme seule raison de bundler — et `require()` d'un module ESM est supporté depuis Node 20.19, sous notre propre plancher. À revoir uniquement si un consommateur réel a besoin de CJS sous Node < 20.19. Bénéfice secondaire : la sortie publiée est du JavaScript lisible qui correspond ligne à ligne à la source, ce qui compte le jour où un utilisateur envoie une pile d'appels.

**La résolution du peer `typescript`.** Elle se fait depuis la racine du **projet analysé** (`createRequire(<projectRoot>/)`) — c'est le compilateur dont l'utilisateur croit déjà la sortie. Sous `npx tssift`, le paquet est installé dans un dossier temporaire que npm ≥ 7 peuplera volontiers de **sa propre** copie du peer : un `import('typescript')` naïf typecheckerait le projet avec un autre compilateur que son `tsc`, et produirait des diagnostics que son outil de référence ne produit pas. C'est la seule panne irrattrapable pour un outil de diagnostic. Si le projet n'a pas de `typescript` : **sortie 2**, en nommant ce qui a été cherché et où — pas de repli silencieux. Sous Yarn PnP, la résolution fonctionne lancée via `yarn dlx` et échoue avec cette même erreur nommée sous `npx` nu, ce qui est honnête et diagnosticable. Le chemin et la version résolus sont exposés comme `Fact` de type `origin` et dans `ProgramFacts.typescript`.

**Les sorties du CLI.** `0` = aucun diagnostic d'erreur ; `1` = des erreurs existent ; `2` = tssift n'a pas pu s'exécuter (tsconfig absent ou invalide, version de TypeScript hors plage, projet illisible).

**Le cas « aucun fichier typechecké » — tranché le 2026-07-27.** Un tsconfig *solution* (`"files": []`, `"include": []`, `"references": [...]`), typique d'une racine de monorepo, ne fait typechecker **aucun** fichier à `tsc -p`, qui sort 0. Reproduire ce 0 tel quel ferait imprimer `0 errors` sur un dépôt entier dont les erreurs sont bien réelles, mais logées dans les projets référencés — un **faux « propre »**, le pire mode de panne pour un outil de diagnostic, et exactement le repli silencieux que la règle 15 interdit. La décision **discrimine par `references`** :

- `fileNames` vide **et** `projectReferences` non vide ⇒ **sortie 2**, message nommant le tsconfig, le nombre de fichiers, le nombre de références et **la liste des chemins référencés**, pour que l'agent sache où pointer. Les project references restent hors périmètre v0.1 : on les **nomme** au lieu de les deviner.
- `fileNames` vide **et** aucune référence ⇒ **on ne refuse pas**. Ici le zéro serait exact, et refuser un projet légitimement vide serait notre propre faux négatif.

**Mesuré le 2026-07-27 sous 5.9.3, et le résultat vaut d'être écrit ici : la seconde branche est inatteignable en pratique, parce que TypeScript la couvre déjà.** Sur exactement la même forme `"files": []` / `"include": []`, retirer `references` fait apparaître **TS18002** (« The 'files' list in config file … is empty ») dans `parsed.errors` ; `"include": []` seul donne **TS18003**. Ces diagnostics de configuration remontent par `configFileParsingDiagnostics` et sortent donc en **1**, avec la formulation du compilateur — jamais en `0` silencieux.

C'est ce qui fait de `references` un discriminant **sain plutôt qu'astucieux** : ce n'est pas nous qui devinons quel zéro est faux, c'est TypeScript qui bénit une seule de ces deux formes — la forme *solution* — et signale l'autre. Notre refus se pose exactement sur le trou que le compilateur laisse ouvert, et sur lui seul. Y ajouter notre propre sortie 2 remplacerait un message précis du compilateur par un message plus vague de notre part.

Ce que la règle 15 interdit n'est pas la sortie `0`, c'est une sortie `0` **fausse**. `projectReferences` est précisément ce qui sépare les deux cas, et il est déjà disponible dans le résultat de `parseJsonConfigFileContent`.

**Corollaire de rendu :** un run propre imprime `0 errors · N files checked`, jamais `0 errors` seul. Le compte de fichiers voyage avec le zéro pour que le zéro soit **vérifiable** — c'est la contrepartie de rendu de la décision ci-dessus, applicable à tout run propre et pas seulement au cas limite. L'agent distingue ainsi « ton code est cassé » de « mon invocation est cassée » sans analyser de texte — c'est la thèse du produit appliquée à nos propres modes de panne. Rapport sur stdout, pannes de l'outil sur stderr. `--project` vaut `./tsconfig.json` par défaut, **sans recherche ascendante** : le déterminisme vaut mieux que la magie. Un run propre imprime une ligne plutôt que rien, pour qu'un succès ne ressemble pas à un plantage avalé.

bun sert de gestionnaire de paquets et de lanceur de scripts. Il ne sert **pas** de runtime de test : les tests tournent sous Node parce que Node est le runtime des utilisateurs. Tester exclusivement sous bun créerait un angle mort exactement là où la casse coûte le plus cher — d'autant que sous bun, `process.version` rapporte la version de Node *émulée* (v24.3.0), pas celle qui est épinglée.

Le partage tient parce que `bun run` respecte le shebang `#!/usr/bin/env node` des binaires de `node_modules/.bin` et délègue à Node (vérifié : Node v20.20.2). Le flag `bun run --bun` court-circuite ce comportement — il est proscrit.

**L'épinglage est local uniquement.** `mise.toml` sert les machines de dev ; la CI ne le lit pas et installe ses propres versions, puisque son travail est justement de balayer une matrice (TS 5.4 → 5.9, plusieurs Node, plusieurs installateurs) qu'une version unique épinglée contredirait.

Contrepartie assumée : l'environnement local n'est pas identique à la CI. La garantie minimale qui rend cet écart supportable — **la version de Node épinglée dans `mise.toml` doit toujours figurer dans la matrice CI**. Sans elle, la configuration sur laquelle on développe au quotidien n'est testée nulle part.

**Compatibilité TS :** matrice CI sur plusieurs versions de TS dès P0. Les codes et messages bougent entre versions mineures — c'est la principale source de casse silencieuse.

### 9.1 Prise en charge de tous les gestionnaires de paquets

Exigence produit, pas seulement confort de dev. Elle a l'air orthogonale au sujet ; elle ne l'est pas, pour deux raisons.

**Raison 1 — l'enrichisseur 2307 en dépend directement.** Distinguer « paquet absent » de « types manquants » de « chemin cassé » suppose de lire la topologie des dépendances du projet analysé. Cette topologie n'est pas la même d'un installateur à l'autre :

| Installateur | Topologie | Conséquence sur le diagnostic |
|---|---|---|
| npm, yarn (node-modules), bun | `node_modules/` à plat, hoisting | une dépendance non déclarée peut se résoudre quand même (dépendance fantôme) |
| pnpm | `node_modules/.pnpm/` + liens symboliques, strict | une dépendance transitive non déclarée **ne résout pas** — cause fréquente de 2307, et invisible dans le message TS |
| yarn PnP | **aucun `node_modules`**, `.pnp.cjs` | tout code supposant l'existence de `node_modules` casse net |

**Raison 2 — l'outil se distribue en `npx`-like.** Le point d'entrée doit fonctionner en `npx tssift`, `bunx tssift`, `pnpm dlx tssift`, `yarn dlx tssift`. La résolution de la `peerDependency` `typescript` diffère selon l'installateur (npm ≥ 7 l'installe automatiquement, pnpm non par défaut, yarn PnP échoue durement si elle manque) : c'est le premier endroit où le CLI peut ne pas démarrer du tout.

**Règles qui en découlent :**
- Ne **jamais** présumer qu'un dossier `node_modules/` existe.
- Ne **jamais** invoquer un gestionnaire de paquets en sous-processus. On lit des fichiers déclaratifs : `package.json`, lockfiles, `.pnp.cjs`, `tsconfig.json`.
- Détecter l'installateur par lockfile (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lock`) et l'exposer comme `Fact` de type `origin`.
- Gérer les protocoles d'espace de travail (`workspace:`, `catalog:`, `link:`, `portal:`) — c'est la fixture monorepo cross-package.
- Ce qu'on en dit reste un **fait**, jamais une conclusion : « `zod` n'apparaît pas dans les `dependencies` de `package.json` », et non « installe `zod` ». Non-objectif n°1.
- Un seul lockfile commité (`bun.lock`) ; les autres sont ignorés par git.

**Matrice d'installation en CI** — axe 3 de §9.2, séparée de la matrice TS pour éviter l'explosion combinatoire.

### 9.2 La matrice CI — trois axes, jamais un produit cartésien

| Axe | Contenu | Ce qui est asserté |
|---|---|---|
| 1 · TypeScript | 5.4.5 · 5.5.4 · 5.6.3 · 5.7.3 · 5.8.3 · 5.9.3, sur Node 20 | **5.9.3** : snapshots texte exacts. Les cinq autres : invariants seulement |
| 2 · Node | 20 · 22 · 24, sur TS 5.9.3 | suite complète |
| 3 · Installateurs | npm · pnpm · yarn (node-modules) · yarn (PnP) · bun, sur un tarball empaqueté | le binaire démarre et produit un diagnostic sur un projet minimal |
| Garde | un projet en TypeScript 7.0.2 | **sortie 2**, et le message est bien celui qui est nommé |

Environ quatorze jobs. Ubuntu seulement. **Windows est hors périmètre pour v0.1**, et c'est écrit dans le README plutôt que laissé dans le flou — la contrepartie assumée étant que la normalisation POSIX des chemins n'est testée par rien.

Le job de garde TS 7 n'est pas décoratif : sans lui, la promesse « sortie 2 avec un message nommé » pourrit dès la première refonte du point d'entrée.

**Les snapshots face à six versions de TS.** Comme le message brut est imprimé verbatim, les snapshots héritent de la formulation de TypeScript, et cette formulation bouge entre mineures — parfois même l'ensemble des diagnostics change, une meilleure inférence pouvant fusionner deux erreurs. D'où : texte exact sur une seule version épinglée, et ailleurs des invariants **tolérants** — le run ne plante pas, la sortie vaut 1, le fichier racine attendu est classé premier, aucun diagnostic n'est perdu par rapport à `--all`. Un snapshot par fixture reste lisible ; six fois plus finiraient régénérés sans être lus, ce qui est précisément l'échec contre lequel ce dépôt se prémunit.

---

## 10. Prior art à lire avant d'écrire une ligne

| Projet | Ce qu'on en prend |
|---|---|
| `ts-error-translator` (Matt Pocock) | Corpus code → explication markdown, réutilisable directement. Vérifier la licence. |
| `pretty-ts-errors` | Techniques de rendu et d'abréviation des types longs |
| `tsc-output-parser` | Parsing texte, utile pour le fallback `TscTextSource` |
| `typescript/src/compiler/diagnosticMessages.json` | Source de vérité des codes |

Positionnement à retenir — **révisé le 2026-07-27 après la vérification T0**, note complète dans `.plans/2026-07-27_prior-art.md`. Ces trois-là visent bien **l'humain dans l'éditeur**, c'est confirmé. En revanche le créneau « consommateur = agent, sortie structurée » **n'est plus inoccupé** : trois serveurs MCP publiés depuis fin 2025 s'y positionnent nommément — `ts-diagnostics-mcp` (`tsc` en watch + cache LRU, pour que N agents concurrents ne relancent pas N compilations), `ts-language-mcp` et `ts-lsp-mcp` (navigation sémantique, diagnostics par fichier). Les trois sont des **passe-plats** : ils rendent l'accès aux diagnostics plus rapide ou plus granulaire, sans changer ni leur nombre ni leur ordre.

Ce qui reste libre est donc plus étroit, et se confond avec ce que §5.1 appelle déjà le composant à plus forte valeur : **hiérarchiser** — regrouper par cause racine, classer par pouvoir explicatif, attacher des faits vérifiables, sans jamais prescrire. Un agent branché sur `ts-diagnostics-mcp` reçoit les mêmes 40 diagnostics dont 39 sont des symptômes du premier, seulement plus vite. Conséquence à assumer : il n'y a pas de marge positionnelle ailleurs que dans P1. Un `tssift` qui s'arrêterait à P0 serait un `tsc-output-parser` avec un en-tête.

**Comment cette lecture se fait, et avec quelle porte.** — *Exécutée le 2026-07-27, porte franchie, note dans `.plans/2026-07-27_prior-art.md`. Le protocole ci-dessous est conservé pour mémoire.* Les trois projets nommés ne se lisent que le temps de confirmer qu'ils visent bien l'humain-dans-l'éditeur. L'effort utile porte ailleurs : **chercher sur npm et GitHub un post-processeur de `tsc` orienté agent ou MCP publié récemment.** Ces trois-là ont été positionnés avant que « outil consommé par un agent » soit une catégorie ; ce qui peut tuer le projet n'est pas l'existence de `pretty-ts-errors`, c'est quelque chose sorti pendant l'écriture de cette spec. Résultat consigné dans une note courte, **y compris s'il est négatif**. Si le créneau s'avère occupé : **s'arrêter et le dire**, avant P0. C'est l'information la plus utile productible à ce stade.

**Licence des corpus tiers — parquée, pas tranchée.** Le corpus de `ts-error-translator` est une table code → prose : son seul consommateur possible est H2, désormais différé derrière les chiffres de l'éval. La question de licence n'a donc pas de décision à prendre tant que B2 n'a pas montré qu'un code donné y gagne. À rouvrir à ce moment-là, pas avant.

---

## 11. Risques

| Risque | Gravité | Mitigation |
|---|---|---|
| **H2 se révèle nulle** | Moyenne | Assumé par design : H1 seule justifie l'outil. L'éval tranche tôt. |
| **Port Go / TS7 casse l'API JS** | **Matérialisé** — `typescript@7.0.2` est `latest` depuis avant la première ligne de code | Le découplage n'est plus une précaution, c'est une contrainte de conception active : le modèle §4 est dimensionné sur le `Diagnostic` de TS 7, le plus pauvre des deux. V1 déclare `>=5.4 <6` et **refuse** 6/7 en sortie 2 plutôt que de deviner. `Ts7ApiSource` est un jalon daté (P2.5), pas une intention. |
| **Obsolescence par le haut** (TS améliore ses messages, les modèles s'améliorent) | Moyenne | Livrer petit et vite. Ne pas bâtir une architecture ambitieuse. |
| **Faux positifs de causalité** — regrouper à tort masque une vraie erreur | **Critique** | Ne jamais *supprimer*, seulement *déclasser*. `--all` restitue tout. Fixture dédiée avec deux racines indépendantes. |
| **Dérive prescriptive** | Élevée | Non-objectif n°1. Interdire l'impératif dans les `Fact.text` — testable par lint sur les fixtures de sortie. |
| **Perf sur gros monorepo** | Faible | `createProgram` domine déjà le coût, notre pipeline est négligeable. Mesurer quand même. |

---

## 12. Definition of Done — v0.1.0

- [ ] `npx tssift` fonctionne sur un projet réel de l'agence
- [ ] Réduction mesurée du volume de diagnostics sur ≥ 3 repos réels, chiffre publié
- [ ] 20 fixtures, bras A et B mesurés, résultats dans `EVAL.md`
- [ ] Matrice CI verte sur TS 5.4 → 5.9, snapshots texte sur 5.9.3
- [ ] Job de garde vert : un projet TypeScript 7 sort en code 2 avec le message nommé
- [ ] `Ts7ApiSource` livré (P2.5) — sinon l'outil ne tourne pas sur le `latest` du registre
- [ ] Matrice d'installation verte : npm · pnpm · yarn (node-modules) · yarn (PnP) · bun
- [ ] Résolution correcte sur les fixtures « dépendance fantôme pnpm » et « Yarn PnP »
- [ ] Zéro faux positif de causalité sur la fixture double-racine
- [ ] README : le pitch, un avant/après, le chiffre de l'éval, l'honnêteté sur ce qui n'a pas marché, et le périmètre (Windows hors v0.1)
- [ ] Serveur MCP branchable en une ligne de config

---

## 13. Le pitch README (brouillon)

> `tsc` a été conçu pour un humain qui a un éditeur. Un agent qui lance `tsc --noEmit` reçoit 40 erreurs dont 39 sont des symptômes de la première — sans aucun moyen de savoir laquelle lire.
>
> `tssift` regroupe les diagnostics par cause racine, les trie par pouvoir explicatif, et attache à chacun les faits que l'éditeur donnerait gratuitement : où le type est déclaré, quels sont ses membres réels, quelle surcharge a échoué.
>
> Il ne vous dit pas quoi corriger. Il vous dit ce qui est vrai.

---

## Première session

1. ~~Vérifier la disponibilité du nom sur npm~~ — fait le 2026-07-27, `tssift` est libre
2. ~~Arrêter le contrat de sortie et le modèle de données~~ — fait le 2026-07-27, intégré dans §3 · §4 · §5 · §6 · §7 · §9

La suite est séquencée, avec critères d'acceptation, dans **`.plans/2026-07-27_p0-b0.md`** — écrit pour être exécuté par un agent sans le contexte de la session qui l'a produit. Ce fichier-ci reste la spec ; le plan reste le mode d'emploi. Si les deux divergent, la spec gagne et le plan se corrige.
