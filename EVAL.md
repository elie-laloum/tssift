# EVAL — mesures

**Dernière mise à jour :** 2026-07-29 (T3+T4 — corpus figé, et le bras modèle qui appuie enfin H1)
**Étage courant :** **B0** — mesure déterministe, **sans aucun appel de modèle**
**Reproduction :** `mise exec -- bun run corpus:build && mise exec -- bun run eval`

---

## Ce que B0 mesure, et ce qu'il ne mesure pas

B0 compare deux textes, rien d'autre :

| Bras | Contenu |
|---|---|
| **A** | la sortie brute de `tsc --noEmit --pretty false` du **compilateur du projet mesuré**, lancé dans le dossier du projet |
| **B** | la sortie `agent-text` de `tssift` sur le même projet |

Trois familles de cibles : les **fixtures** (le contrat, minuscules), les **dépôts réels vivants** (représentatifs mais instables), et le **corpus** — du vrai code figé à un commit épinglé puis cassé par une mutation d'une ligne, décrit dans `eval/corpus.json`. C'est le corpus qui porte le signal.

Deux métriques : le **nombre de diagnostics** affichés de chaque côté, et le **nombre de caractères**. Le caractère est le primitif publié — n'importe qui peut le reproduire sans faire confiance à notre tokenizer, et le **rapport** A/B, qui est la revendication réelle, est de toute façon quasi indépendant du tokenizer.

Une estimation en tokens est donnée en `caractères / 4`. **Le diviseur est 4, il est annoncé ici, et c'est une estimation, pas une mesure.**

B0 ne dit **rien** de H2, rien du taux de correction, rien des faux départs. Ces métriques exigent un modèle et arrivent en B1/B2.

### Précautions de mesure

- Le bras A **lance réellement le `tsc` du projet** (`node <typescript résolu>/../tsc.js`) plutôt que de réimplémenter son formatage : le nombre publié est littéralement le texte que l'agent lirait, ligne de résumé comprise.
- `--incremental false` et un `--tsBuildInfoFile` en dossier temporaire : sans quoi un projet en `incremental` déposerait un `.tsbuildinfo` dans un dépôt réel simplement parce qu'on l'a mesuré.
- Pour chaque dépôt réel, `git status --porcelain` est relevé avant et après, et un écart fait sortir le harnais en 1 en **nommant** le dépôt concerné.

---

## Ligne de base — 2026-07-27, P0 (avant causalité)

Chiffres obtenus par deux exécutions consécutives donnant un résultat **identique**, sans avertissement de l'arbre de travail.

| cible | type | ts | A diags | B diags | A car. | B car. | B/A car. | A ~tok | B ~tok |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| partial-interface-rename | fixture | 5.9.3 | 3 | 3 | 523 | 697 | **133 %** | 131 | 174 |
| two-independent-roots | fixture | 5.9.3 | 2 | 2 | 223 | 319 | **143 %** | 56 | 80 |
| overload-mismatch | fixture | 5.9.3 | 1 | 1 | 571 | 1176 | **206 %** | 143 | 294 |
| lekes | dépôt réel | 5.9.3 | 8 | 8 | 1475 | 1877 | **127 %** | 369 | 469 |
| tccp | dépôt réel | 5.9.3 | 0 | 0 | 0 | 40 | n/a | 0 | 10 |
| keyzia/data-explorer | dépôt réel | — | — | — | — | — | **refusé, sortie 2** ¹ | — | — |
| nextp/cursor-rules-hooks | dépôt réel | 6.0.3 | — | — | — | — | **refusé, sortie 2** | — | — |
| corpus/lekes-result-value-renamed | corpus | 5.9.3 | 112 | 112 | 18 548 | 19 102 | **103 %** | 4 637 | 4 776 |
| corpus/lekes-task-export-renamed | corpus | 5.9.3 | 12 | 12 | 1 677 | 1 804 | **108 %** | 419 | 451 |
| corpus/lekes-ok-arity-changed | corpus | 5.9.3 | 153 | 153 | 17 602 | 32 025 | **182 %** | 4 401 | 8 006 |

**Totaux sur les 8 cibles mesurées : diagnostics A = 283, B = 283. Caractères A = 39 144, B = 55 243, soit B/A = 141 %.**

*C'est la ligne de base contre laquelle P1 se mesure (T7 du plan).*

¹ **`keyzia/data-explorer` a changé de statut le 2026-07-27, et pas par dérive : par correction d'un bug.** Sa racine porte un tsconfig *solution* (`"files": []`, `"include": []`, `"references": [4]`). `tsc -p` n'y typecheckait **rien** et sortait 0 ; les deux bras étaient d'accord sur `0 diagnostic`, et ce `0` était **faux** — les erreurs du monorepo existent, elles sont logées dans les projets référencés. Un agent y lisait un « propre » imaginaire, exactement le repli silencieux que la règle 15 interdit. La cible sort désormais en **2** en nommant le tsconfig, les comptes et les quatre chemins référencés. Décision et mesure en PROJECT.md §9.

Effet sur les totaux : une cible mesurée en moins (9 → 8) et **33 caractères de moins** côté B — le bras A y valait 0 caractère, donc le rapport B/A reste **141 %**. Le chiffre de diagnostics, lui, ne bouge pas d'une unité.

**Deux autres écarts à ne pas prendre pour du bruit** si l'on rejoue la mesure aujourd'hui. D'abord, `lekes` **vivant** est redescendu à `0 / 0` : c'est l'instabilité déjà documentée en « Limites du corpus », et la raison même de figer un corpus. Ensuite, un run propre imprime désormais `0 errors · N files checked` au lieu de `0 errors` — le compte de fichiers voyage avec le zéro pour le rendre vérifiable, ce qui ajoute une vingtaine de caractères aux seules cibles sans diagnostic.

### Le corpus réel confirme l'hypothèse du coût fixe

Les trois entrées `corpus/` sont du **vrai code** (`lekes`, 169 fichiers TS), figé à un commit épinglé, cassé par une mutation d'une ligne. Détail et méthode : `eval/corpus.json`.

Sur les deux cascades à cause unique et large, le surcoût **s'effondre** : **103 %** et **108 %**. C'est la confirmation directe de ce que la tendance des fixtures laissait deviner — l'essentiel du surcoût de P0 est **fixe** (en-tête, préfixes de code), donc il se dilue dès que le rapport grossit. Sur les cibles qui ressemblent au cas d'usage réel, `agent-text` coûte aujourd'hui **3 à 8 % de plus** que `tsc` brut, pas 106 %.

**L'exception à 182 % (`lekes-ok-arity-changed`) est instructive et a été vérifiée.** 152 de ses 153 diagnostics portent un `relatedInformation` — *« An argument for 'origin' was not provided. »* pointant `src/shared/domain/result.ts:15:33` — que `tsc --pretty false` n'imprime **pas du tout**. Le surcoût est donc, à 100 %, de l'information ajoutée, répétée 152 fois.

Et cette information n'est pas décorative : **chacun de ces 152 related désigne la déclaration qui est la cause racine.** C'est un lien structurel, présent dans les données capturées, exactement du type que PROJECT.md §5.1 autorise à exploiter — et c'est P1 qui devra décider s'il s'en sert pour dériver, puis replier ces 152 lignes en une racine et un compteur.

⚠️ **Ne pas citer le total seul.** Il est dominé par la cible la plus grosse, et il bouge donc avec elle sans rien dire du produit : au cours de la même session, avec un `lekes` plus cassé, ce même total valait 124 %. **Les rapports par cible et leur tendance avec la taille sont les seuls chiffres lisibles ici.**

---

## Lecture honnête de la ligne de base

**Le gain de P0 était nul sur les diagnostics et négatif sur les caractères.** Même nombre des deux côtés — **283 contre 283** — et une sortie 3 % à 106 % plus grosse selon la cible. *(Une version antérieure de cette phrase annonçait « 14 contre 14 » : c'était le total d'avant l'existence du corpus, resté en place après que le tableau eut été refait. Corrigé le 2026-07-27.)*

Ce n'est pas une contre-performance, c'est le résultat attendu et annoncé (`.plans/2026-07-27_p0-b0.md` § T9, PROJECT.md §6) : **en P0 il n'y a ni causalité ni enrichissement.** Le bras B contient exactement les mêmes diagnostics que le bras A, seulement reformatés et annotés. Le pliage des cascades — le mécanisme qui porte H1 — arrive en **P1**, et le tableau « après P1 » plus bas est ce qu'il a donné.

### D'où viennent les caractères en plus

Vérifié sur `overload-mismatch`, où l'écart est le plus fort (571 → 1176 caractères). Le bras A brut, en entier :

```
src/transport/client.ts(4,10): error TS2769: No overload matches this call.
  Overload 1 of 3, '(url: string, options: GetOptions): string', gave the following error.
    Type '"POST"' is not assignable to type '"GET"'.
  Overload 2 of 3, '(url: string, options: PostOptions): string', gave the following error.
    Type '"exponentail"' is not assignable to type '"exponential" | "linear"'. Did you mean '"exponential"'?
  Overload 3 of 3, '(url: string, options: StreamOptions): string', gave the following error.
    Type '"POST"' is not assignable to type '"STREAM"'.
```

Les 605 caractères supplémentaires de B se répartissent en trois postes, et un seul est du pur formatage :

1. **~430 caractères de `relatedInformation` que `tsc --pretty false` n'imprime pas du tout.** C'est le poste dominant, et le fait est vérifié : la sortie ci-dessus ne contient aucun des trois `The expected type comes from property … which is declared here`, ni leur position. `tssift` les imprime avec `fichier:ligne:colonne`. **Ce ne sont pas des caractères gaspillés : c'est une information que l'agent devrait autrement aller chercher avec un `Read` ou un `Grep`,** dont le coût n'apparaît dans aucune colonne de ce tableau.
2. **~48 caractères de préfixes `TSxxxx: `** sur les nœuds de chaîne. `tsc` indente les nœuds sans jamais donner leur code, alors qu'une chaîne 2769 se termine ici sur un 2820 et que c'est ce code-là qui informe.
3. **~45 caractères d'en-tête** (`root:` + ligne de résumé), payés une fois par run, donc négligeables dès qu'un projet a plusieurs erreurs.

**La tendance avec la taille est le chiffre à retenir** : 206 % sur une fixture à 1 diagnostic, 127 % sur un dépôt réel à 8. Le surcoût est en grande partie fixe ; c'est le bruit en cascade, que P1 attaque, qui croît.

### Ce que ce tableau ne dit pas

- **Il ne dit rien de H1.** H1 porte sur les faux départs et sur les tokens *une fois les cascades pliées*. Aucune cascade n'est pliée ici.
- **Il ne compte pas les lectures évitées.** Un `related` positionné remplace potentiellement un `Read`. B0 mesure la taille du rapport, pas le coût total de la boucle d'agent. C'est B1 qui tranchera, et c'est aussi ce qui décidera de la variante `--snippets`.
- **Il ne compare que du texte.** La sortie `json`, rapport complet et futur consommable MCP, est plus grosse encore et n'est pas mesurée ici.

---

## Résultats — 2026-07-27, après P1 (causalité + regroupement)

**C'est le chiffre de H1.** Même protocole, même corpus, même jour, même version de TypeScript que la ligne de base ci-dessus. Seul le bras B a changé : il passe désormais par `dedupe → detectCausality → entriesOf` avant le renderer.

`B diags` compte les **entrées** du rapport, pas les diagnostics. C'est précisément le déplacement que P1 revendique : après pliage, une entrée peut représenter toute une cascade. Le total qu'elles couvrent reste intégralement dans `json`, et `--all` le restitue ligne à ligne.

| cible | type | ts | A diags | B entrées | pliage | A car. | B car. | B/A car. | A ~tok | B ~tok |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| partial-interface-rename | fixture | 5.9.3 | 3 | 1 | 67 % | 523 | 831 | 159 % | 131 | 208 |
| **two-independent-roots** | fixture | 5.9.3 | 2 | **2** | **0 %** | 223 | 319 | 143 % | 56 | 80 |
| overload-mismatch | fixture | 5.9.3 | 1 | 1 | 0 % | 571 | 1 176 | 206 % | 143 | 294 |
| broken-barrel-export | fixture | 5.9.3 | 3 | 1 | 67 % | 361 | 568 | 157 % | 90 | 142 |
| arity-changed | fixture | 5.9.3 | 4 | 1 | 75 % | 313 | 725 | **232 %** | 78 | 181 |
| **narrowed-union-member** | fixture | 5.9.3 | 8 | 1 | **88 %** | 1 365 | 804 | **59 %** | 341 | 201 |
| nullable-chain | fixture | 5.9.3 | 4 | **4** | **0 %** | 334 | 429 | 128 % | 84 | 107 |
| missing-required-property | fixture | 5.9.3 | 3 | **3** | **0 %** | 449 | 759 | 169 % | 112 | 190 |
| assignability-mismatch | fixture | 5.9.3 | 3 | **3** | **0 %** | 284 | 640 | 225 % | 71 | 160 |
| misspelled-property | fixture | 5.9.3 | 2 | **2** | **0 %** | 254 | 486 | 191 % | 64 | 122 |
| unconstrained-generic | fixture | 5.9.3 | 4 | **4** | **0 %** | 448 | 562 | 125 % | 112 | 141 |
| value-used-as-type | fixture | 5.9.3 | 4 | **4** | **0 %** | 579 | 678 | 117 % | 145 | 170 |
| wrong-tsconfig-paths | fixture | 5.9.3 | 4 | 2 | **50 %** | 477 | 666 | 140 % | 119 | 167 |
| monorepo-cross-package | fixture | 5.9.3 | 4 | 1 | **75 %** | 416 | 569 | 137 % | 104 | 142 |
| phantom-dependency-pnpm | fixture | 5.9.3 | 3 | 1 | **67 %** | 303 | 481 | 159 % | 76 | 120 |
| yarn-pnp-project | fixture | 5.9.3 | 3 | 1 | **67 %** | 331 | 510 | 154 % | 83 | 128 |
| missing-type-import | fixture | 5.9.3 | 3 | **3** | **0 %** | 430 | 527 | 123 % | 108 | 132 |
| cannot-find-name | fixture | 5.9.3 | 7 | **7** | **0 %** | 493 | 598 | 121 % | 123 | 150 |
| missing-multiple-properties | fixture | 5.9.3 | 3 | **3** | **0 %** | 429 | 533 | 124 % | 107 | 133 |
| **two-roots-one-file** | fixture | 5.9.3 | 4 | **2** | **50 %** | 356 | 654 | 184 % | 89 | 164 |
| corpus/lekes-result-value-renamed | corpus | 5.9.3 | 112 | 22 | **80 %** | 18 548 | 3 742 | **20 %** | 4 637 | 936 |
| corpus/lekes-task-export-renamed | corpus | 5.9.3 | 12 | 1 | **92 %** | 1 677 | 711 | **42 %** | 419 | 178 |
| corpus/lekes-ok-arity-changed | corpus | 5.9.3 | 153 | 2 | **99 %** | 17 602 | 1 061 | **6 %** | 4 401 | 265 |

**Totaux sur les 25 cibles mesurées : diagnostics A = 349 → entrées B = 72 (pliage de 79 %). Caractères A = 46 766, B = 18 149, soit B/A = 39 %.**

*Les quatre lignes `missing-type-import`, `cannot-find-name`, `missing-multiple-properties` et `two-roots-one-file` datent du 2026-07-28 (T0 de B1). Les trois lignes 2307 — `wrong-tsconfig-paths`, `phantom-dependency-pnpm`, `yarn-pnp-project` — ont été **remesurées le même jour après T1** : elles plient désormais (78 → 72 entrées). Fait à ne pas mélire : leur `B/A` de caractères **monte** (121–133 % → 140–159 %) alors qu'elles plient. C'est le même effet que `partial-interface-rename` — sous le plafond de trois sites tous les diagnostics s'impriment encore, et l'en-tête de cause (`cause: unresolved module 'qs'` + la ligne de compte) s'ajoute par-dessus. **Le gain de T1 y est structurel — le lecteur apprend que la panne est UN module absent, pas trois — pas volumétrique.** Le total passe donc de 38 % à 39 % en pliant, exactement pour cette raison.*

### Le chiffre que vingt fixtures permettent de donner : **8 sur 17** (5 avant T1)

Vingt fixtures, dont trois ne sont pas des cascades à cause unique : `overload-mismatch` n'a qu'un diagnostic, et **deux témoins négatifs à plusieurs racines** — `two-independent-roots` (deux causes, deux fichiers, deux codes) et `two-roots-one-file` (deux causes, un fichier, un code). Restent **dix-sept cascades à cause unique**. Avant T1 le seuil en pliait cinq ; **la règle 2307 (T1, 2026-07-28) en ajoute trois**, portant le compte à **huit** :

| plie | ne plie pas |
|---|---|
| `partial-interface-rename` (3 → 1) · `broken-barrel-export` (3 → 1) · `arity-changed` (4 → 1) · `narrowed-union-member` (8 → 1) · `monorepo-cross-package` (4 → 1) · **`wrong-tsconfig-paths` (4 → 2)** · **`phantom-dependency-pnpm` (3 → 1)** · **`yarn-pnp-project` (3 → 1)** | `nullable-chain` (18047) · `missing-required-property` (2741) · `missing-multiple-properties` (2739) · `assignability-mismatch` (2322) · `misspelled-property` (2551) · `unconstrained-generic` (2536) · `value-used-as-type` (2749) · `missing-type-import` (1484) · `cannot-find-name` (2304) |

`wrong-tsconfig-paths` plie **4 → 2** et non 4 → 1 : ses deux spécificateurs (`@domain/order` ×3, `@domain/customer` ×1) sont deux modules distincts, et le second, seul, reste sous le minimum de deux membres. Regrouper deux alias sous un en-tête serait le sur-regroupement que §11 classe critique — la règle sort donc deux entrées, à dessein.

**C'est la mesure la plus utile produite depuis le chiffre de H1.** Jusqu'à T1 elle disait que le pliage ne reposait pas sur une propriété générale des cascades mais sur **la liste de six codes de `src/codes.ts`** ; T1 l'a nuancée. **2307 plie sans être dans cette liste** — il ne demande aucun code de capture, il travaille sur `ProgramFacts.imports` et le message verbatim. Le pliage tient donc à deux mécanismes : un `declaredAt` identique (les cinq premiers) et un spécificateur non résolu partagé (les trois 2307). Hors de ces deux liens, une cascade parfaitement réelle est encore rendue à plat, et les neuf non-pliages sortent entre **117 % et 225 %**, le surcoût de P0.

**Le rapport a monté puis rebaissé selon ce qui entrait — 4/10, 5/14, 5/17 (T0), puis 8/17 (T1) — et rien de tout cela n'est une régression.** T0 ajoutait des cascades de codes non capturés (`missing-type-import` TS1484, `cannot-find-name` TS2304, `missing-multiple-properties` TS2739) plus le témoin négatif `two-roots-one-file` ; le rapport tombait donc. T1, le même jour, a écrit la règle 2307 et fait plier les trois fixtures qui la débloquaient : `wrong-tsconfig-paths` (4 → 2), `phantom-dependency-pnpm` et `yarn-pnp-project` (3 → 1). Les cinq pliages `declaredAt` sont inchangés au caractère près.

À noter que ce n'est pas un plafond de conception :

- 18047 · 2741 · 2739 · 2322 · 2551 sont dans la table des dix de §5.2 et attendent les chiffres (règle 8) ; 2749 et 1484 sont hors table (format natif assumé), et 2304 est la deuxième moitié de la liste de racines de §5.1, sœur non écrite de la règle 2307 ;
- **2307 est désormais un pliage acquis, pas un manque.** Sa règle de dérivation (T1) ne travaille que sur `ProgramFacts.imports` et le message, sans capture de contexte ; elle n'était pas différée par manque de données mais par manque de fixture, et ce manque a été comblé au T0 précédent. Détail ci-dessous.

### `assignability-mismatch` tranche la question de conception n° 2 — et la réponse est non

La question du plan P1 : **le span d'un `related` peut-il servir de clé de regroupement ?** Elle avait été classée *sans objet*, puis rouverte par `missing-required-property`, dont les trois diagnostics impriment tous un `related` désignant exactement leur cause commune. Cette fixture-ci la referme, dans l'autre sens, par construction plutôt que par argument.

Sa cause est `type Currency = "EUR" | "USD"` à `src/pricing/currency.ts:6` — l'union a perdu `"GBP"`. Or :

- **deux** de ses trois diagnostics portent un `related`, et il pointe `currency.ts:9:3` — la **propriété** `currency` de `Rate`. Cette ligne est **du code correct**, que le lecteur ne doit pas toucher ;
- le **troisième** — une annotation directe, `const reportingCurrency: Currency = "GBP"` — ne porte **aucun** `related`.

Une règle indexée sur le `related` regrouperait donc deux diagnostics sur trois, **en tête desquels une déclaration qui n'a pas besoin d'être modifiée**, et laisserait le troisième dehors. Envoyer le lecteur sur la mauvaise ligne est le mode de défaillance que §11 classe critique ; il est simplement plus discret que la fusion de deux bugs indépendants. **Un `related` pointe là où le compilateur a jugé utile d'expliquer *ce* diagnostic-là, ce qui n'est pas la même chose que la cause.**

Les deux fixtures se lisent donc ensemble : `missing-required-property` montre un lien présent et juste, `assignability-mismatch` un lien présent et trompeur. La règle n'est pas seulement non prouvée, elle est **fausse**. Un test nommé la garde (`test/causality.test.ts`).

### `value-used-as-type` marque le bord extérieur du seuil

Quatre diagnostics, une cause, et **rien à capturer** : ni `related`, ni déclaration résolvable. `OrderStatus` existe bel et bien — c'est un objet `const` — il n'a simplement aucun sens en position de type. Le compilateur n'a donc aucun lien structurel à offrir. Toute règle qui plierait cette cascade devrait travailler sur l'identifiant et `ProgramFacts.imports`, c'est-à-dire dériver sur « le même nom » — précisément ce que §5.1 interdit. Ce n'est pas un manque de capture, c'est la limite de ce que le seuil structurel peut atteindre, et il est utile de l'avoir commitée.

### La règle 2307, écrite en T1 — ce que les trois fixtures lui ont imposé

§5.1 laissait la règle 2307 — « tout ce qui importe le module non résolu est dérivé » — non écrite. **Elle l'est depuis T1 (2026-07-28)**, et elle plie les TS2307 par spécificateur : `phantom-dependency-pnpm` et `yarn-pnp-project` 3 → 1, `wrong-tsconfig-paths` 4 → 2, le 2307 solitaire de `two-independent-roots` inchangé. Trois choses que ces fixtures ont imposées à sa forme, et qu'aucun raisonnement à sec n'avait données :

1. **La cascade est *de* 2307, pas *depuis* un 2307.** Un import non résolu donne `any` aux liaisons importées et n'émet plus rien en aval : sur les trois fixtures, **tout** diagnostic est un 2307. La règle plie donc des 2307 entre eux — elle ne récolte pas « les erreurs des fichiers qui importent », il n'y en a aucune.
2. **La clé est le spécificateur, jamais le fichier.** `src/api-client.ts` de `phantom-dependency-pnpm` importe `@acme/http`, qui résout, **et** `qs`, qui ne résout pas. `imports[file]` seul ne dit pas lequel a échoué ; le **message verbatim** nomme le spécificateur en échec (`Cannot find module 'qs' …`), et ce nom, recoupé avec `imports[file]`, donne la clé. Ce recoupement est le garde de correction : tout ce que la table d'imports ne confirme pas — gabarit dérivé, spécificateur relatif, forme non parcourue — reste une racine isolée, jamais une fusion.
3. **Regrouper tous les 2307 d'un projet serait un sur-regroupement.** `wrong-tsconfig-paths` en porte trois sur `@domain/order` et un sur `@domain/customer` — une cause unique en amont, la ligne `paths`, mais elle n'est dans **aucun fichier du programme**, donc rien dans les données ne la nomme. La règle sort **deux entrées**, une par spécificateur, et non une.

Le point 3 est le plus intéressant des trois : `wrong-tsconfig-paths` est la fixture dont la cause racine n'est pas dans le programme du tout. Aucun `declaredAt` ne peut la désigner, par construction — un module qui ne résout pas n'a pas de déclaration —, d'où l'en-tête d'un genre nouveau, `cause: unresolved module '<spec>'`, sans « declared at ». C'est un bord du seuil différent de celui de `value-used-as-type` : là il n'y avait aucun lien à capturer, ici le lien est le spécificateur lui-même.

### `monorepo-cross-package` fait travailler le garde-fou plutôt que de le répéter

Le garde-fou n° 1 de §5.1 refuse comme cause toute déclaration hors des fichiers du programme — `<ts-lib>/…`, `node_modules/…` — et il est né d'un TS2345 du corpus qui résolvait vers `interface Map`. Jusqu'ici toutes les fixtures qui plient avaient leur cause dans le même paquet, donc le garde-fou n'y était jamais mis en tension. Celle-ci a ses quatre diagnostics dans `packages/api` et `packages/web`, et sa cause dans `packages/core` : un paquet frère n'est ni `<ts-lib>/…` ni `node_modules/…`, donc le garde-fou doit **admettre**, et il admet. `ProgramFacts.files` fait autorité, pas un test de préfixe — c'est ce choix-là qui est vérifié ici.

Accessoirement, c'est la première fixture à dépasser le plafond de trois sites en pliant : quatre diagnostics, trois affichés, `+1 more site`.

### `yarn-pnp-project` est la seule fixture dont le `before/` ne contient aucun bug

Le code y est correct, `@acme/http` est déclaré dans `package.json`, verrouillé dans `yarn.lock`, présent sur le disque sous `.yarn/unplugged/`, et référencé par `.pnp.cjs`. Les trois TS2307 ne disent rien du projet : ils disent que le compilateur a été lancé en processus Node nu, sans charger la carte de résolution de PnP. Toutes les autres fixtures sont du code cassé ; celle-ci est du code juste, mal lu.

**Conséquence sur tssift lui-même, à écrire dans le README plutôt qu'à découvrir dans une issue : tssift est un processus Node nu.** Sous un projet PnP il produirait exactement cette sortie — trois erreurs plausibles et entièrement fausses — s'il n'était pas lancé au travers du runtime (`yarn tssift`). C'est le mode de défaillance le plus coûteux imaginable pour un outil dont l'argument est « faites confiance à la hiérarchisation » : rien n'est signalé, la sortie a l'air normale.

**Tranché et implémenté en T2 (2026-07-28) : le CLI refuse.** `run.ts` détecte un `.pnp.cjs` à la racine du projet **sans** `process.versions.pnp` **et** au moins un TS2307 rendu, et sort en **2** avec un message qui nomme le manifeste trouvé et le remède (`yarn tssift`). Le triple garde évite de refuser un projet PnP sain lancé hors runtime mais sans erreur de résolution. La garde vit en **couche CLI**, pas dans la source : la bibliothèque et l'éval continuent de plier `yarn-pnp-project` 3 → 1 (c'est ce qui rend le pliage mesurable ci-dessus), seul le CLI refuse. Prédicat pur `isPnpMisread`, testé.

### Les quatre fixtures de T0 — la dernière catégorie de §7, et le témoin négatif dur

Le quatrième lot porte le corpus à vingt et **ferme la liste des catégories de §7**. Aucun des quatre ne plie, et pour trois d'entre eux c'est le comportement voulu.

- **`missing-type-import` (TS1484)** couvre la dernière catégorie de §7 sans témoin, « import de type manquant ». `verbatimModuleSyntax` est activé et deux fichiers importent des types avec un import de valeur : trois TS1484, le module résolvant parfaitement — ce n'est donc pas un TS2307, le correctif est un mot-clé et non une dépendance. C'est le complément de `value-used-as-type` (une valeur en position de type, 2749) : ici un type en position de valeur. Hors table des dix, il sort au format natif, et il témoigne au passage que trois diagnostics d'un même code sur deux fichiers restent trois racines isolées faute de lien de dérivation.
- **`cannot-find-name` (TS2304)** est la première fixture à produire 2304, que §5.1 classe **racine quasi certaine** au même titre que 2307 et qu'aucune fixture n'exerçait — le seuil n'avait jamais vu que la moitié de sa propre liste de racines. Sept références à un seul nom manquant dans un fichier : une vraie cascade à cause unique dont la structure calque celle de 2307 (le nom donne un type d'erreur à chaque usage, rien ne cascade au-delà). Elle ne plie pas — 2304 n'est ni capturé ni dérivé — donc elle chiffre le manque qu'une future règle indexée sur le nom manquant comblerait, sœur de la règle 2307 non écrite.
- **`missing-multiple-properties` (TS2739)** est le jumeau multi-membres de `missing-required-property` (2741) : trois sites de construction, deux membres requis manquants au lieu d'un, tous pointant la déclaration de `Rect`. Comme son jumeau il ne plie pas — ni 2739 ni 2741 n'est capturé — et il donne enfin un témoin à 2739, présent dans la table des dix sans fixture jusqu'ici.
- **`two-roots-one-file` (TS2339)** est le témoin négatif dur, sœur de `two-independent-roots`. Là où celle-ci sépare deux causes dans deux fichiers sous deux codes, celle-ci met **deux causes dans un fichier sous un seul code** — le cas où le sur-regroupement est le plus tentant et, selon §11, le plus destructeur. La règle 3 de §5.1 (« mêmes 2339 dans le même fichier ⇒ une racine ») est délibérément **non** appliquée, et c'est ici qu'elle se vérifie : chaque interface est mal lue deux fois, donc une règle indexée sur fichier + code replierait les quatre sous un seul en-tête et cacherait un des deux bugs derrière un compteur. Le moteur indexe sur `declaredAt` et rend `4 errors · 1 file · 2 root causes` — les deux de `Widget` pliés, les deux de `Gauge` pliés, les deux causes tenues à part. Contrairement à `two-independent-roots`, cette fixture **plie** de chaque côté (4 → 2), et c'est précisément l'intérêt : la séparation survit même quand le pliage est actif sur les deux racines. Un test nommé la garde.

**Le total se dégrade à chaque petite fixture ajoutée, et ce n'est pas une régression du produit.** 20 % à trois fixtures, 22 % à quatre, 27 % à huit, 31 % à douze, 35 % à seize, 38 % à vingt (T0), 39 % après T1 : chaque petite fixture entre avec un rapport supérieur à 100 % et tire la moyenne vers le haut, et le pliage 2307 de T1 en ajoute même un peu — sur une cible minuscule, plier ajoute un en-tête sans rien retrancher (toutes les lignes tiennent sous le plafond). **À périmètre constant les chiffres publiés sont inchangés au caractère près** — retirer les treize lignes ajoutées après coup redonne exactement 283 → 29, 39 144 contre 7 960, soit 20 %. C'est la raison pour laquelle §7 publie un rapport par cible : **ce total-ci mesure surtout la composition de la liste**.

### Ce que les fixtures de pliage ont appris

**1. Une petite fixture peut passer sous 100 %, et `narrowed-union-member` est la première : 59 %.** Huit diagnostics pour une entrée. Ce qui change par rapport aux autres petites cibles, c'est que ses diagnostics sont **verbeux** — chacun porte un nœud de chaîne nommant le membre d'union fautif — donc le plafond à trois sites en supprime réellement du volume. Le pliage paie dès que le diagnostic unitaire est gros, pas seulement quand la cascade est longue.

**2. `arity-changed` sort à 232 %, le pire rapport du tableau — et c'est le même code que la meilleure ligne du tableau.** TS2554 donne **6 %** sur `corpus/lekes-ok-arity-changed` (153 diagnostics) et **232 %** ici (4 diagnostics). Même famille, même règle de causalité, même renderer ; seule la taille de la cascade diffère. La cause du surcoût est identique dans les deux cas — les `relatedInformation` que `tsc --pretty false` n'imprime pas du tout, ici répétées trois fois pour 313 caractères de bras A — mais à 4 sites le pliage n'en retire qu'un, alors qu'à 153 il en retire 150. **C'est H1 énoncée en une comparaison : le gain n'est pas dans le format, il est dans le nombre de sites qu'une cause explique.**

**3. Deux fixtures ne plient pas du tout, et c'est leur raison d'être.** `nullable-chain` (4 × TS18047) et `missing-required-property` (3 × TS2741) sont des cascades à cause unique qu'un humain regroupe d'un coup d'œil ; le seuil de §5.1 les laisse en racines isolées, parce que ni 18047 ni 2741 n'est dans `CONTEXT_CAPTURE_CODES`. Les deux codes sont dans la table des dix de §5.2, donc c'est un manque connu en attente des chiffres (règle 8), pas un oubli. Elles sont commitées précisément pour que ce manque soit **mesurable** plutôt qu'anecdotique : 128 % et 169 % sont le prix courant de ce que le seuil refuse.

**4. `missing-required-property` a rouvert une question fermée.** Ses trois diagnostics **impriment déjà leur cause commune** : chacun porte un `related` lisant `src/accounts/profile.ts:10:3: 'locale' is declared here.` Le rapport nomme donc trois fois la même déclaration partagée et refuse quand même de grouper dessus. C'est la question de conception n° 2 du plan P1 — *le span d'un `related` compte-t-il comme un `declaredAt` ?* — classée **sans objet** parce que TS2554 s'était finalement résolu par `getResolvedSignature()`. Ici elle avait un objet. **`assignability-mismatch` l'a refermée depuis, par la négative** — section suivante.

Comparé à la ligne de base P0 — **283 / 283, 141 %** — le rapport de caractères est divisé par **six à sept** selon le périmètre.

### Ce que ce tableau dit, et ce qu'il ne dit pas

**Il dit que H1 tient sur du vrai code.** Sur les trois entrées de corpus, qui sont les seules cibles ressemblant au cas d'usage réel, le rapport passe de 103–182 % à **6–42 %**. `lekes-ok-arity-changed` est le cas d'école : 153 diagnostics répartis sur 31 fichiers deviennent 2 entrées, dont une qui nomme `src/shared/domain/result.ts:15:19` — la ligne qu'il faut lire — et un compteur pour les 149 sites restants.

**Il dit aussi que le pliage ne rend rien sur un petit projet *dont les diagnostics sont courts*.** `partial-interface-rename` passe de 133 % à **159 %**, et `broken-barrel-export` sort à **157 %** : leurs trois diagnostics tiennent sous le plafond de trois sites, donc tous s'impriment encore, et l'en-tête de cause s'ajoute par-dessus. Le gain y est structurel — le lecteur apprend *où* est la cause — pas volumétrique. Sur un projet de trois erreurs, `tsc` n'a de toute façon pas de problème de bruit.

*La restriction en italique a été ajoutée le 2026-07-28 : la version précédente disait « sur un petit projet », sans condition, et `narrowed-union-member` la contredit à **59 %** avec ses huit diagnostics sur trois fichiers. Ce n'est pas la taille du projet qui décide, c'est le produit « nombre de sites × verbosité du diagnostic unitaire ». Détail dans la section suivante.*

Le cas de `broken-barrel-export` est le plus net des deux, parce que le pliage y est **exactement** ce que la fixture existe pour montrer : trois fichiers différents importent le même symbole d'un barrel, `tsc` les rapporte comme trois échecs sans lien, et `tssift` nomme `src/domain/index.ts:1:1` une fois. 157 % de caractères pour une entrée au lieu de trois, sur un projet où le pliage n'a mécaniquement rien à économiser.

**Le témoin négatif tient : `two-independent-roots` reste à 2 entrées pour 2 diagnostics, pliage 0 %.** C'est la mesure la plus importante du tableau après les trois entrées de corpus. Deux échecs sans lien restent deux échecs, et le critère de la Definition of Done (§12) est vérifié par un test nommé, pas seulement observé ici.

**Il ne dit toujours rien de H2**, ni du taux de correction, ni des faux départs. Ces métriques exigent un modèle et arrivent en B1/B2. Ce que B0 mesure ici est un volume et un compte, pas un comportement.

**Le sous-regroupement est visible et volontaire.** `lekes-result-value-renamed` plie 80 %, pas 99 % : 21 de ses 112 diagnostics restent isolés — 10 TS7006 (paramètre `any` implicite, aucune déclaration à viser), 8 TS2339 dont le récepteur est `{}` ou `unknown`, 2 TS2353 et 1 TS2345. Aucun ne porte de lien structurel vers la cause. Les regrouper demanderait de dériver sur une ressemblance, ce que §5.1 interdit. C'est le comportement voulu.

---

## P1 T1 — ce que la capture sélective rapporte, et ce qu'elle coûte

**Mesuré le 2026-07-27** sous TypeScript 5.9.3, reproductible par `mise exec -- bun run capture:measure`. Décision 28 du plan P1 : toute extension de `CONTEXT_CAPTURE_CODES` se paie en allers-retours de checker, donc elle se mesure avant d'être gardée. Codes capturés : **2305 · 2339 · 2345 · 2353 · 2554 · 2724**, justifiés un par un dans `src/codes.ts`.

**2724 est arrivé en dernier, par T6, et il n'était pas prévu.** La fixture `broken-barrel-export` devait produire du 2305 ; elle produit du 2724 (`… Did you mean 'Order'?`) parce que TypeScript préfère la variante « suggestion » dès qu'un nom proche existe parmi les exports réels du module. **Le code qui sort dépend donc des noms en présence, pas de la nature de la panne** — une cascade identique aurait plié ou non selon l'orthographe choisie par l'auteur. Le tableau ci-dessous le montre : 2305 et 2724 résolvent au même endroit, par le même resolver.

Le taux de résolution est la part des diagnostics du code qui reviennent avec un `declaredAt` exploitable.

| cible | code | résolus | où pointe le `declaredAt` |
|---|---|---:|---|
| partial-interface-rename | 2353 · 2339 · 2345 | 3/3 (100 %) | **une seule et même position**, `src/types/user.ts:7:1` |
| two-independent-roots | 2339 | 1/1 | `src/billing/invoice.ts:3:1` — et le 2307 n'a **aucun** contexte |
| broken-barrel-export | 2724 | 3/3 (**100 %**) | 3 sur `src/domain/index.ts:1:1`, le barrel — pas `order.ts`, qui exporte toujours |
| corpus/lekes-result-value-renamed | 2339 | 91/99 (**92 %**) | 91 sur `src/shared/domain/result.ts:12:4` |
| corpus/lekes-task-export-renamed | 2305 | 12/12 (**100 %**) | 12 sur `…/domain/task.entity.ts:1:1` |
| corpus/lekes-ok-arity-changed | 2554 | 152/152 (**100 %**) | 152 sur `src/shared/domain/result.ts:15:19` |

**C'est le gisement de H1, vu pour la première fois sous forme de lien structurel** et non d'intuition : 152 diagnostics sur une déclaration, 91 sur une autre, 12 sur une troisième. Rien n'est encore plié — T3 et T4 le feront — mais la matière du pliage existe et elle est vérifiable.

### Le coût en temps est dans le bruit

Meilleur de 3 exécutions, capture désactivée puis activée :

| cible | off | on | écart |
|---|---:|---:|---:|
| partial-interface-rename | 180 ms | 167 ms | −7 % |
| two-independent-roots | 157 ms | 152 ms | −3 % |
| overload-mismatch | 175 ms | 183 ms | **+5 %** |
| broken-barrel-export | 182 ms | 176 ms | −4 % |
| corpus/lekes-result-value-renamed | 3 947 ms | 3 738 ms | −5 % |
| corpus/lekes-task-export-renamed | 4 426 ms | 4 006 ms | −10 % |
| corpus/lekes-ok-arity-changed | 3 781 ms | 4 342 ms | **+15 %** |

*Tableau rejoué le 2026-07-27 en fin de T6, avec 2724 dans la liste. Les valeurs bougent de plusieurs points d'un run à l'autre — `overload-mismatch` était à −3 % au premier passage et sort à +5 % ici, sans qu'aucun de ses diagnostics ne soit capturé, donc sans qu'une seule ligne de code de capture s'y exécute. C'est la meilleure démonstration disponible que ces chiffres mesurent la machine autant que l'outil.*

Les écarts négatifs sont la preuve que la mesure est dominée par la variance : la capture ne peut pas *accélérer* le chargement. `createProgram` et `getPreEmitDiagnostics` coûtent quatre secondes sur 169 fichiers ; la descente d'arbre par diagnostic et la résolution de type se perdent dedans. **Sous le seuil de ~20 % de la décision 28, donc la capture paresseuse n'a pas lieu d'être discutée — mais le pire cas, `lekes-ok-arity-changed` avec ses 152 résolutions de signature, est monté à +15 % sur ce second run et n'est plus « très en dessous ».** C'est la cible à re-mesurer si un code de plus entre dans la liste.

### Le coût en volume est réel, lui

| cible | json off | json on | écart |
|---|---:|---:|---:|
| partial-interface-rename | 2 767 | 5 205 | +88 % |
| two-independent-roots | 1 711 | 2 217 | +30 % |
| broken-barrel-export | 2 646 | 4 893 | +85 % |
| corpus/lekes-result-value-renamed | 104 154 | 160 225 | +54 % |
| corpus/lekes-task-export-renamed | 44 437 | 52 536 | +18 % |
| corpus/lekes-ok-arity-changed | 183 926 | 276 037 | +50 % |
| overload-mismatch | 3 378 | 3 378 | 0 % |

*Les deux colonnes ont grossi depuis la première mesure (`partial-interface-rename` : 2 410 → 2 767 côté « off ») parce que le rapport `json` porte désormais `groups`, `role` et `derivedFrom`. Le côté « on » inclut donc aussi les groupes que la capture rend possibles — c'est la comptabilité honnête : sans contexte capturé, aucun groupe n'existe, leurs octets font partie de ce que la capture coûte.*

`memberNames`, `signature` et le `snippet` du `declaredAt` sont répétés une fois par diagnostic. **C'est du `json` uniquement — `agent-text` est inchangé, donc la ligne de base B0 ci-dessus ne bouge pas d'un caractère.**

**Et l'écart n'est pas devenu négatif après T4, contrairement à ce que cette section pariait.** Le pliage se voit dans `agent-text`, où il fait passer le rapport de 141 % à 20 % ; le `json`, lui, reste le rapport complet par construction (règle 14) et ne plie rien — il *ajoute* l'index de groupes par-dessus le tableau intégral. Le pari était mal posé : il n'y a pas de contradiction à corriger, seulement deux formats qui font deux métiers. Si le volume `json` devient un problème pour MCP, c'est une déduplication du rapport qu'il faudra, jamais un retrait de la capture.

### Un avertissement pour T3, sorti de la mesure

Sur `corpus/lekes-result-value-renamed`, l'unique TS2345 résout son `expected` vers **`<ts-lib>/lib.es2015.collection.d.ts:19:1 (interface Map)`**.

C'est correct comme capture, et ce serait un **désastre comme critère de causalité** : deux bugs parfaitement indépendants qui passent chacun un mauvais argument à une méthode de `Map` partageraient ce `declaredAt` et seraient regroupés. C'est très exactement le sur-regroupement que §11 classe *critique*.

Conséquence à tenir en T3 : **une déclaration hors des fichiers du programme — `<ts-lib>/…`, `node_modules/…` — ne peut pas servir de cause racine.** La capture reste, parce qu'elle est vraie et qu'un enrichisseur P2 en voudra ; c'est la dérivation qui doit la refuser.

Second constat de la même famille : sur cette entrée, les 2339 pointent le *littéral de type* (`result.ts:12:4`) et le 2353 pointe l'*alias* (`result.ts:11:1`). Deux positions distinctes, donc deux groupes là où un humain en verrait un. C'est du **sous-regroupement**, l'asymétrie que §5.1 assume explicitement : on desserrera avec des chiffres, on ne resserre pas après un raté.

---

## Limites du corpus — à corriger avant B1

Trois problèmes, tous constatés le jour même de la première mesure. Aucun n'invalide la ligne de base ; tous les trois rendent le corpus réel inutilisable tel quel pour B1.

**1. `lekes` est un arbre de travail vivant.** Mesuré trois fois en une heure, il a donné **23, puis 29, puis 8 diagnostics** (6 668, 8 141, puis 1 475 caractères en bras A). Quelque chose le modifie en continu. Le garde-fou `git status` a d'ailleurs signalé un écart avant/après sur une des exécutions ; vérification faite, **notre mesure n'a rien écrit** — aucun fichier des trois dépôts n'a été modifié, et une exécution isolée ressort l'arbre inchangé. C'est une édition concurrente extérieure.

Deux conséquences. D'abord, un dépôt en cours de travail **n'est pas une cible de mesure** : ses chiffres absolus sont l'instantané d'un objet mobile. Ensuite, le garde-fou ne sait pas distinguer « on a écrit » de « quelqu'un d'autre a écrit pendant qu'on lisait » — il le dit désormais explicitement dans son message plutôt que de laisser conclure au pire.

Consolation mesurable : sur ces trois états très différents, le **rapport** B/A est resté dans une bande étroite — 114 %, 113 %, 127 % — alors que les valeurs absolues variaient d'un facteur 5. C'est exactement l'argument pour lequel §7 publie un rapport et non une valeur.

**2. Les dépôts réels vivants sont propres — RÉSOLU le 2026-07-27 par `eval/corpus.json`.** `tccp` et `keyzia/data-explorer` ont zéro diagnostic, et `lekes` oscille autour de zéro. Points de mesure valides mais **sans information**.

La piste évidente — « prendre des instantanés de dépôts au moment où ils étaient cassés » — **ne marche pas**, et c'est un résultat en soi. Scan du 2026-07-27 : **14/14 commits de `lekes` et 24 commits échantillonnés sur 240 de `data-explorer` compilent proprement.** On commite du vert ; la CI y veille. **Les états cassés vivent dans les arbres de travail, pas dans l'historique** — et un arbre de travail bouge sous la mesure (problème 1).

D'où la solution retenue : **commit épinglé + mutation authorée**. Chaque entrée de `eval/corpus.json` est un `sha` réel plus un `find`/`replace` d'une ligne, matérialisé par `bun run corpus:build` dans `.corpus/` via `git archive` — sans jamais toucher à l'arbre source. Trois propriétés qu'aucune autre option n'avait ensemble :

- **figé** — un `sha` ne bouge pas, donc les chiffres sont comparables d'un mois sur l'autre ;
- **open source** — le dépôt public ne contient que des références et des mutations, jamais le code privé de `lekes` ; `.corpus/` est git-ignoré ;
- **vérité terrain** — on sait **par construction** quel fichier est la cause. C'est précisément ce que la métrique de faux départ de B1 exige, et qu'un commit cassé trouvé au hasard ne fournit pas.

Le corpus produit aujourd'hui **277 diagnostics répartis sur 3 causes racines**, en trois familles de codes distinctes (TS2339, TS2305, TS2554). Le garde-fou du script refuse une ancre absente, ambiguë, ou qui ne casse finalement rien.

Deux pièges rencontrés en le construisant, tous deux encodés dans le script :
- une ancre doit viser un fichier **suivi au `sha` épinglé** — `git archive` ignore les fichiers non suivis, et l'arbre de `lekes` en contient plusieurs ;
- une mutation peut s'appliquer sans rien casser. Retirer un export du barrel `features/agents` n'a produit **aucun** diagnostic : ses 11 importateurs consomment chacun un symbole différent. Cette entrée a été retirée plutôt que maquillée ; le cas barrel reste couvert par la fixture `broken-barrel-export`, la quatrième prévue.

**3. La couverture de versions est plus étroite qu'annoncée.** `.plans/2026-07-27_p0-b0.md` donnait `lekes` en TS 5.7 et `tccp` en TS 5.5 ; les deux sont en fait en **5.9.3** au 2026-07-27. Les deux restent dans la plage, mais la mesure ne couvre en pratique que **5.9.3 et 5.8.3**. La matrice CI reste le seul endroit où 5.4 → 5.7 est exercé.

---

## Un témoin non planifié de la règle 15

`nextp/dev-tools/cursor-rules/hooks` porte **TypeScript 6.0.3**. Il n'était pas prévu au protocole, et il rend sur du code réel le service que le job de garde CI est censé rendre en laboratoire : `tssift` y **sort en 2** avec un message qui nomme la version résolue, son chemin et la plage supportée. Aucun mode dégradé, aucun avertissement sur stderr suivi d'un run bancal.

C'est la première confirmation hors laboratoire que le refus fonctionne, et elle vaut d'être notée : un dépôt en TS 6 traînait déjà sur la machine de développement avant que la première ligne de code du projet soit écrite. La contrainte de PROJECT.md §3 n'est pas une précaution théorique.

---

## B1 — le bras modèle (harnais construit, T4 de B1)

**Étage B1, distinct de B0.** B0 (tout ce qui précède) ne compare que deux textes et n'appelle aucun modèle. B1 met un vrai agent dans la boucle et mesure son **comportement** — c'est là que H1 se teste sur autre chose qu'un compte de caractères.

### Protocole (reproductible depuis cette section seule)

Harnais maison sous `eval/agent/` (`mise exec -- bun run eval:agent`), **sans dépendance runtime** : boucle tool-use sur `fetch` global de Node 20 contre un endpoint **OpenAI-compatible** (`POST <base>/chat/completions`), pas de SDK. Le `system` est le premier message, les outils sont des `{type:"function", …}`, et le modèle répond avec des `tool_calls`. Par cible, deux bras qui ne diffèrent **que** par le cadrage initial du diagnostic :

- **A** = la sortie brute de `tsc --noEmit --pretty false`.
- **B** = la sortie du **CLI réel** de tssift (`run()`), en `agent-text` — donc B reflète aussi les refus de la garde PnP (T2) : sur `yarn-pnp-project`, le bras B reçoit la sortie 2 « Yarn PnP », pas un rapport.

Même **prompt système** fixe, mêmes **trois outils que nous implémentons** (`read_file`, `write_file`, `run_typecheck`, confinés à une copie jetable de `before/`), même plafond de tours (**12**), `temperature: 0` (reproductible run à run), **n = 5**. Le modèle et l'endpoint sont **pilotés par l'environnement** — `OPENAI_BASE_URL` (défaut `https://api.openai.com/v1`), `OPENAI_API_KEY`, `AGENT_MODEL` — donc le même harnais mène un hôte OpenAI, un fournisseur compatible, ou un serveur local sans changer une ligne. Le modèle exact utilisé sera **consigné ici avec les chiffres**. Cible : les **20 fixtures** + les **3 entrées de corpus** = 23 cibles × 2 bras × 5 = **230 runs**.

### Les quatre métriques, et d'où elles sortent

| métrique | ce qu'elle teste | source dans le harnais |
|---|---|---|
| correction au 1er essai | H2 | `run_typecheck` final à 0 diagnostic |
| tours avant vert | H1 + H2 | compteur de boucle |
| **taux de faux départ** | **H1, le cœur** | un `write_file` **hors** de l'ensemble racine autorisé, intercepté à l'appel |
| régressions | garde-fou | run non résolu après édition |

**Le faux départ est la métrique porteuse**, et elle exige une vérité terrain machine-lisible : `rootCauseFiles` a été ajouté à chaque `meta.json` (T4-prep) — l'ensemble des chemins qu'un correctif valide (au sens de `expectedFix`) peut toucher. Écrire hors de cet ensemble est un faux départ. `yarn-pnp-project` porte `rootCauseFiles: []` : son `before/` n'a aucun bug, donc **toute** écriture y est un faux départ.

### Résultats — 2026-07-28, `cx/gpt-5.6-terra` (n=5, 230 runs)

**Premier balayage réel.** Modèle `cx/gpt-5.6-terra` via un gateway OpenAI-compatible auto-hébergé, `temperature: 0`, plafond 12 tours, n=5, les 20 fixtures + 3 entrées de corpus. Le tableau brut est en fin de section ; ce qui compte est la lecture, et elle **n'est pas flatteuse** — ce qui est un livrable, pas un échec.

**H2 — correction au 1er essai : aucun signal.** Les 230 runs finissent verts, **100 % des deux côtés, sur chaque cible.** Ce modèle résout toutes les fixtures quel que soit le cadrage ; la métrique ne discrimine donc rien ici. C'est un fait sur *ce* modèle et *ces* tâches (petites, une seule cause locale) — pas une réfutation de H2, mais une absence de prise : il faudrait des tâches plus dures, ou un modèle plus faible, pour que « atteindre le vert » sépare les deux bras.

**H1, tokens — tient sur le vrai code, comme en B0.** Sur les **trois entrées de corpus**, les seules cibles réalistes, le bras B consomme **34 % de tokens en moins au total** (95 613 contre 144 601) : `lekes-ok-arity-changed` **33 089 → 11 191** (le pliage 153 → 2 du cadrage initial se paie en contexte réémis à chaque tour), `result-value-renamed` 42 403 → 30 770, `task-export-renamed` 69 109 → 53 652. Sur les petites fixtures c'est mitigé, exactement comme le rapport de caractères de B0 : le gain est volumétrique quand la cascade est grosse, nul ou négatif quand elle est courte.

**H1, faux départ — le cœur, et il ne valide pas.** Sur 115 runs par bras : **bras A 16 faux départs, bras B 19** — le rapport structuré n'a *pas* réduit les faux départs, il en a même un peu plus. Ils se concentrent sur une famille précise :

- **module non résolu** (`phantom-dependency-pnpm`, `two-independent-roots`, `yarn-pnp-project`) : ~100 % des deux côtés. Face à `Cannot find module 'qs'`, le modèle atteint le vert en **écrivant un `src/qs.d.ts`** qui déclare le module — un contournement qui compile mais ne touche jamais la vraie cause (`package.json`, l'import, la dépendance manquante). Ni le rapport de tssift, ni même **le refus PnP en sortie 2**, ne l'en détournent : sur `yarn-pnp-project`, à qui le bras B ne rend *que* le message « lance via yarn », l'agent stube quand même et rend le projet « vert » — donc **faux, sur un projet sans bug**. La garde T2 protège un lecteur humain ; un agent déterminé passe outre.
- **`corpus/lekes-result-value-renamed` : bras B *pire* que A** (80 % contre 40 %), sur une édition d'un fichier non impliqué (`mcp-tool-executor.adapter.ts`). Un contre-signal net à H1 sur une entrée réelle.

**Ce que ce balayage établit, honnêtement.** Un modèle capable, sur ce corpus étroit : (1) corrige tout, des deux côtés — H2 sans prise ici ; (2) coûte moins de tokens avec le rapport plié, sur le gros code réel — la revendication volumétrique de H1 tient ; (3) ne fait **pas** moins de faux départs avec le rapport structuré — la revendication centrale de H1 n'est **pas** soutenue par ce run, et le mode de défaillance dominant (stuber un `.d.ts` sur une erreur de module) est indépendant du format du diagnostic. C'est **un** point de mesure, un modèle, un corpus que le plan lui-même dit trop étroit (T3 non fait) ; ce n'est pas un verdict, mais c'est le chiffre obtenu, et il tempère H1 plutôt qu'il ne le confirme.

### Tableau brut

| cible | bras | runs | vert | tours | faux départ | ~tokens |
|---|---|---:|---:|---:|---:|---:|
| partial-interface-rename | A | 5 | 100 % | 5.0 | 0 % | 4 854 |
| partial-interface-rename | B | 5 | 100 % | 4.0 | 0 % | 4 341 |
| overload-mismatch | A | 5 | 100 % | 5.0 | 0 % | 4 720 |
| overload-mismatch | B | 5 | 100 % | 4.0 | 0 % | 4 325 |
| broken-barrel-export | A | 5 | 100 % | 4.6 | 0 % | 4 742 |
| broken-barrel-export | B | 5 | 100 % | 4.8 | 0 % | 5 229 |
| arity-changed | A | 5 | 100 % | 7.0 | 0 % | 7 101 |
| arity-changed | B | 5 | 100 % | 7.6 | 0 % | 9 133 |
| narrowed-union-member | A | 5 | 100 % | 4.6 | 0 % | 5 781 |
| narrowed-union-member | B | 5 | 100 % | 5.8 | 0 % | 7 489 |
| nullable-chain | A | 5 | 100 % | 7.4 | 0 % | 7 445 |
| nullable-chain | B | 5 | 100 % | 7.8 | 0 % | 7 665 |
| missing-required-property | A | 5 | 100 % | 5.8 | 0 % | 5 568 |
| missing-required-property | B | 5 | 100 % | 5.0 | 0 % | 5 481 |
| missing-multiple-properties | A | 5 | 100 % | 5.0 | 0 % | 3 847 |
| missing-multiple-properties | B | 5 | 100 % | 5.0 | 0 % | 4 001 |
| assignability-mismatch | A | 5 | 100 % | 5.0 | 0 % | 3 725 |
| assignability-mismatch | B | 5 | 100 % | 4.2 | 0 % | 3 704 |
| misspelled-property | A | 5 | 100 % | 4.0 | 0 % | 2 685 |
| misspelled-property | B | 5 | 100 % | 4.2 | 0 % | 3 457 |
| unconstrained-generic | A | 5 | 100 % | 4.0 | 0 % | 3 297 |
| unconstrained-generic | B | 5 | 100 % | 4.0 | 0 % | 3 431 |
| value-used-as-type | A | 5 | 100 % | 5.0 | 0 % | 4 439 |
| value-used-as-type | B | 5 | 100 % | 5.0 | 0 % | 4 527 |
| missing-type-import | A | 5 | 100 % | 4.6 | 0 % | 3 928 |
| missing-type-import | B | 5 | 100 % | 4.6 | 0 % | 4 059 |
| cannot-find-name | A | 5 | 100 % | 5.2 | 0 % | 4 484 |
| cannot-find-name | B | 5 | 100 % | 4.2 | 0 % | 3 543 |
| wrong-tsconfig-paths | A | 5 | 100 % | 5.0 | 0 % | 5 521 |
| wrong-tsconfig-paths | B | 5 | 100 % | 5.2 | 0 % | 6 091 |
| monorepo-cross-package | A | 5 | 100 % | 7.4 | 0 % | 8 454 |
| monorepo-cross-package | B | 5 | 100 % | 5.8 | 0 % | 6 166 |
| two-roots-one-file | A | 5 | 100 % | 4.0 | 0 % | 3 569 |
| two-roots-one-file | B | 5 | 100 % | 4.0 | 0 % | 3 536 |
| **two-independent-roots** | A | 5 | 100 % | 6.0 | **80 %** | 5 320 |
| **two-independent-roots** | B | 5 | 100 % | 5.8 | **100 %** | 5 278 |
| **phantom-dependency-pnpm** | A | 5 | 100 % | 4.4 | **100 %** | 3 959 |
| **phantom-dependency-pnpm** | B | 5 | 100 % | 5.4 | **100 %** | 6 275 |
| **yarn-pnp-project** | A | 5 | 100 % | 4.8 | **100 %** | 5 099 |
| **yarn-pnp-project** | B | 5 | 100 % | 7.2 | **100 %** | 10 761 |
| **corpus/lekes-result-value-renamed** | A | 5 | 100 % | 4.8 | **40 %** | 42 403 |
| **corpus/lekes-result-value-renamed** | B | 5 | 100 % | 4.8 | **80 %** | 30 770 |
| corpus/lekes-task-export-renamed | A | 5 | 100 % | 4.6 | 0 % | 69 109 |
| corpus/lekes-task-export-renamed | B | 5 | 100 % | 5.8 | 0 % | 53 652 |
| corpus/lekes-ok-arity-changed | A | 5 | 100 % | 4.2 | 0 % | 33 089 |
| corpus/lekes-ok-arity-changed | B | 5 | 100 % | 4.2 | 0 % | 11 191 |

*`~tokens` = `usage.total_tokens` cumulés sur la boucle, dominés par le cadrage initial réémis à chaque tour. Reproductible : `mise exec -- bun run eval:agent`, endpoint dans `.env`.*

### Résultats sur le corpus figé — le vrai test de H1 (2026-07-29)

Le premier balayage (ci-dessus) tournait sur des fixtures trop faciles : le modèle corrigeait tout, sans faux départ, quel que soit le cadrage. Le **corpus figé** (§ « le vrai test de H1 » — cinq cascades profondes de 20 à 65 diagnostics, une cause, des dizaines de sites, correctif ambigu) est écrit pour que le bruit morde. Balayage sur les 5 entrées, deux modèles, `temperature: 0`, n=5 : `cx/gpt-5.6-terra` (fort) et `cx/gpt-5.4-mini` (faible). **Cette fois H1 a une prise, et le signal est positif.**

**gpt-5.6-terra (fort) :**

| cible | bras | vert | tours | faux départ | ~tokens |
|---|---|---:|---:|---:|---:|
| dispatch-arity-changed | A | 100 % | 5.0 | 0 % | 16 503 |
| dispatch-arity-changed | B | 100 % | 4.8 | 0 % | 7 189 |
| mapper-argtype-changed | A | 100 % | 5.4 | 0 % | 23 071 |
| mapper-argtype-changed | B | 100 % | 5.2 | 0 % | 10 726 |
| **order-book-field-renamed** | A | 80 % | 7.2 | **100 %** | 25 215 |
| **order-book-field-renamed** | B | 100 % | 5.2 | **0 %** | 7 063 |
| registry-barrel-dropped | A | 100 % | 4.8 | 0 % | 8 809 |
| registry-barrel-dropped | B | 100 % | 5.0 | 0 % | 6 318 |
| shape-tag-renamed | A | 80 % | 8.8 | 100 % | 41 454 |
| shape-tag-renamed | B | 100 % | 7.6 | 100 % | 15 988 |

**gpt-5.4-mini (faible) :**

| cible | bras | vert | tours | faux départ | ~tokens |
|---|---|---:|---:|---:|---:|
| dispatch-arity-changed | A | 100 % | 5.0 | 0 % | 15 171 |
| dispatch-arity-changed | B | 100 % | 4.4 | 0 % | 5 832 |
| mapper-argtype-changed | A | 100 % | 5.2 | 0 % | 18 048 |
| mapper-argtype-changed | B | 100 % | 5.0 | 0 % | 8 073 |
| **order-book-field-renamed** | A | 100 % | 5.0 | **100 %** | 18 997 |
| **order-book-field-renamed** | B | 100 % | 7.6 | **60 %** | 16 873 |
| registry-barrel-dropped | A | 100 % | 5.0 | 0 % | 8 649 |
| registry-barrel-dropped | B | 100 % | 4.0 | 0 % | 4 795 |
| shape-tag-renamed | A | 100 % | 9.6 | 100 % | 66 593 |
| shape-tag-renamed | B | 100 % | 7.4 | 100 % | 21 942 |

**Ce que ça dit, honnêtement — et c'est plus encourageant que le premier run.**

1. **Tokens : le bras B fait à peu près moitié moins, sur les deux modèles.** Total fort 115 052 → 47 284 (**41 %**), faible 127 458 → 57 515 (**45 %**). Le pliage du cadrage initial se paie en contexte réémis à chaque tour, et un petit modèle le paie cher. La revendication volumétrique de H1 tient nettement.

2. **Faux départ : le bras B les réduit — le cœur de H1, enfin visible.** Fort **10/25 → 5/25** (divisé par deux), faible **10/25 → 8/25**. Le cas d'école est **`order-book-field-renamed`** (un champ d'entité renommé, lu à 17 sites) : le rapport plat pousse **les deux modèles à patcher les 17 sites** (100 % de faux départ), alors que le rapport plié — qui nomme `interface Order declared at src/domain/order.ts` — envoie le modèle fort sur **la seule déclaration** (0 %) et le faible bien mieux (60 %, contre 100 %). C'est très exactement la thèse de H1, démontrée.

3. **Correction : le bras B l'améliore aussi sur les cascades dures.** Côté fort, `order-book` et `shape-tag` passent de 80 % à 100 % de vert — le rapport plat a fait échouer un run (12 tours à patcher des sites sans converger) là où le rapport plié réussit à chaque fois.

4. **Mais ce n'est pas une garantie : `shape-tag-renamed` résiste.** 100 % de faux départ des deux côtés, sur les deux modèles. Nommer la cause (le tag d'union renommé) ne suffit pas : les modèles éditent quand même les consommateurs et la factory plutôt que de revenir sur la déclaration. Le pliage aide fortement quand la cause est une déclaration nette et la tentation « patcher N sites » ; il n'immunise pas contre un modèle qui décide de traiter les symptômes.

**Verdict corpus.** Sur du code profond — le cas d'usage réel, pas les fixtures — le pliage **économise ~la moitié des tokens et réduit les faux départs**, le plus nettement là où le nombre de sites rend le patch-par-symptôme tentant. Le premier run « H1 non soutenue » était largement un artefact de tâches trop faciles ; ce corpus figé, lui, soutient H1 sur les tokens et l'appuie sur le faux départ, sans le sur-vendre (`shape-tag` reste un contre-exemple honnête).

*Reproductible : `AGENT_TARGETS=corpus/… AGENT_MODEL=… mise exec -- bun run eval:agent`. Corpus committé sous `corpus/`, endpoint dans `.env`.*

---

## P2 — l'enrichissement : ce qu'il ajoute, et ce qu'il coûte (2026-08-01)

Six codes reçoivent un enrichisseur — **2339, 2353, 2345, 2554, 2305, 2724** — et la règle qui les sélectionne tient en une ligne : *un enrichisseur sort quand le fait qu'il produit est déjà capturé et que TypeScript ne l'imprime pas déjà.* Ce sont exactement les codes dont la charge utile est un **site de déclaration** et une **liste de membres**, deux choses qu'un lecteur de terminal ne peut obtenir d'aucune façon et qu'un éditeur donne au survol.

### Le coût en volume, mesuré contre la ligne de base P1

Même harnais B0, mêmes 25 cibles, la seule variable étant la présence de l'étage `enrich` et de la ligne de fait sous l'en-tête de cause.

| | B chars, P1 | B chars, P2 | delta | B/A, P1 | B/A, P2 |
|---|---:|---:|---:|---:|---:|
> **Les valeurs absolues de ce tableau ne se reproduisent pas — corrigé le 2026-08-02.** Le harnais passait alors au renderer le chemin **absolu** du projet en guise de `rootLabel`, ce que `run.ts` ne fait pas : le bras B portait `/home/<user>/…` et grossissait de la longueur du chemin de checkout, sur un seul des deux bras. **Les deltas ci-dessous restent justes** (la constante s'annule dans une différence) ; les totaux et les rapports B/A ne le sont pas. Mesuré à nouveau après correction, le même code donne **16 038 et B/A 51 %**. Détail en § P2/2307.

| **total, 25 cibles** | 16 861 | 17 538 | **+4,0 %** | **54 %** | **56 %** |
| `corpus/shape-tag-renamed` | 759 | 797 | +38 | 8 % | 9 % |
| `corpus/mapper-argtype-changed` | 990 | 1 043 | +53 | 17 % | 18 % |
| `corpus/order-book-field-renamed` | 574 | 657 | +83 | 21 % | 24 % |
| `corpus/registry-barrel-dropped` | 590 | 649 | +59 | 24 % | 26 % |
| `corpus/dispatch-arity-changed` | 773 | 821 | +48 | 39 % | 41 % |

**Le chiffre à retenir : sur une cascade profonde, l'enrichissement coûte 40 à 85 caractères — de l'ordre de 10 à 20 tokens — pour un site de déclaration et la liste des propriétés réelles.** C'est le pliage qui paie la facture : les faits se rendent **une fois par groupe**, pas une fois par diagnostic, donc une cascade de 65 diagnostics repliée en une entrée porte une seule ligne de propriétés. Le rapport global passe de 54 % à 56 % et les cinq cibles de corpus restent entre 9 % et 41 %.

La contrepartie est visible sous `--all`, où il n'y a plus de groupe pour amortir : chaque diagnostic reporte ses faits. C'est le comportement voulu — `--all` restitue tout — mais c'est là que l'enrichissement est cher, et il faut le savoir avant de le mesurer par accident.

### Le near-match n'existe pas, et c'est une mesure

§5.2 demandait un « candidat proche (Levenshtein) » sur 2339. Il n'est pas implémenté, et la raison n'est pas la difficulté.

**TypeScript émet TS2551 / TS2724 *à la place de* TS2339 / TS2305 dès que son propre correcteur orthographique trouve un candidat.** Tout diagnostic qui parvient à un enrichisseur est donc, par construction, un cas que TypeScript a déjà examiné et rejeté. Une suggestion de notre part ne peut se déclencher que là où le sien a dit non.

Mesuré le 2026-08-01 sur les 20 fixtures et les 5 cascades de corpus, avec un seuil transcrit de `getSpellingSuggestion` (`len × 0,4 + 1`) :

| code | diagnostics avec liste de membres résolue | TS avait suggéré | notre near-match se déclenche |
|---|---:|---:|---:|
| 2339 | 113 | **0** | **38** |
| 2353 | 1 | 0 | 0 |
| 2305 / 2724 | 24 | 0 | 0 |

Les 38 déclenchements sont **deux cas distincts, faux tous les deux** : `kind` → `id` et `side` → `id`, distance 2, sur `shape-tag-renamed`. Sur un nom de quatre lettres une distance de 2 ne signifie rien. Et la cible est précisément la cascade qui **résiste à 100 % dans les deux bras en B1** : un fait qui y nomme `id` enverrait le modèle sur la mauvaise déclaration, c'est-à-dire exactement la panne que la règle 1 existe pour empêcher. Aucun `Fact` de type `near-match` n'est produit, sur aucun code, et un test le garde.

### Deux choses que §5.2 et §6 supposaient et que les fixtures ont démenties

1. **`checker.typeToString` d'un type nommé rend son nom, pas sa forme.** L'exemple de §6 montrait `interface 'CreateUserInput'` suivi de `{ id: string; email: string; name?: string }` ; ce rendu n'existe pas pour un type nommé — on obtient `CreateUserInput`, et la ligne se lirait `type 'CreateUserInput' CreateUserInput`. **C'est donc la liste des propriétés, et non la forme, qui porte l'information sur un type nommé.** La forme n'est rendue que là où elle n'est pas le nom : une signature résolue (`(action: string, actor: string): AuditEvent` sur TS2554) ou un type anonyme.
2. **« member » est le mauvais mot.** Pour une union, un *member* est un constituant, pas une propriété : `1 member: type` sur `type Shape = Circle | Square` se lit « cette union a un bras » alors qu'il faut lire « une propriété est accessible dessus ». La fixture qui l'a révélé s'appelle `narrowed-union-member`. La sortie dit **`property`** pour un type et **`export`** pour un module.

### Quatre codes de §5.2 ne sortent pas, chacun pour une raison nommée

- **2769** — §5.2 le classe premier, la mesure le rétrograde. Toute sa charge utile est **déjà dans `chain`** : TypeScript imbrique un TS2772 par candidat, portant la signature *et* l'erreur qui l'a tué, et le renderer imprime cet arbre depuis P0. Ce que §5.2 voulait ajouter — « laquelle échoue le plus tard, et sur quel argument » — **n'est pas dérivable du capturé** : sur `overload-mismatch`, la seule fixture à chaîne ramifiée, les trois branches ont la même profondeur et une feuille chacune. Aucun signal structurel ne les sépare ; les classer voudrait dire lire les messages sémantiquement, c'est-à-dire deviner.
- **2322** — le chemin de divergence demande les deux types comme structures. Seul le côté attendu est capturé, et comme `SymbolRef`, pas comme arbre.
- **2307** — ses faits portent sur la **topologie installée** (déclaré ou non dans `package.json`, hoisting, PnP, `paths`). C'est de la lecture de fichiers, qu'un étage de pipeline n'a pas le droit de faire (règle 4) : il faut un nouveau canal `ProgramFacts` rempli par la source. La moitié *causalité* de 2307 est livrée depuis B1/T1 et plie ses trois fixtures. — **Levé le 2026-08-02** : le canal existe (`ProgramFacts.resolution`) et 2307 est le septième enrichisseur. Ce diagnostic-ci s'est avéré exact au mot près, ce qui est la seule raison de le laisser écrit ; § P2/2307.
- **18047 / 18048** — l'origine de la nullabilité est une question de flot de contrôle ; rien de capturé n'y répond.

Et **2551 sort en no-op délibéré** : il est déjà bon nativement et §5.2 interdit de le dégrader. Il est absent de la table, donc il se rend exactement comme TypeScript l'a écrit.

### Un garde-fou ajouté au harnais, parce qu'un total absurde a failli être publié

Le `.corpus/` privé (trois copies dérivées d'un dépôt qui n'existe plus sur cette machine) rendait un bras A à **0 diagnostic** et un bras B à 754 : son propre `tsc` ne typecheckait plus rien pendant que `TsApiSource` parcourait encore l'arbre. Replié dans les totaux, cela donnait un **`B/A 1235 %`** — un nombre qui décrit une copie cassée et se lit comme une affirmation sur le produit.

`measure.ts` refuse désormais ces lignes : les deux bras lisent le même tsconfig avec le même compilateur, donc « A trouve 0, B trouve beaucoup » n'est pas un résultat mais une cible périmée. La ligne est marquée `incoherent`, exclue des totaux, et la raison est imprimée. Le `corpus/` committé de T3 est immunisé par construction — c'est exactement pourquoi il a été committé.

---

## P2 / 2307 — l'enrichisseur de module, et un chiffre publié qui ne se reproduisait pas (2026-08-02)

Septième enrichisseur, et le seul qui ne lit **aucun** `context` : ses faits viennent du canal `ProgramFacts.resolution` que la source remplit à l'ingestion (PROJECT.md §4). Le blocage annoncé le 2026-08-01 — « il manque un canal, pas du code » — s'est vérifié à la lettre : le canal fait 148 lignes, l'enrichisseur 60.

### D'abord, la correction : le harnais mesurait un produit que personne ne livre

`measure.ts` passait au renderer `rootLabel: projectDir`, **le chemin absolu**, là où `run.ts` passe `relative(process.cwd(), facts.root)`. La ligne `root:` du bras B portait donc `/home/<user>/…` dans la seule métrique que ce projet publie. Trois conséquences, toutes mauvaises :

- **le bras B grossissait de la longueur du chemin de checkout** — ~27 caractères par cible ici, soit **~675 sur un total de 25** ;
- **un seul des deux bras était touché.** Le bras A lance `tsc` avec `cwd: projectDir` et imprime des chemins relatifs. Le biais gonflait donc exactement le côté dont ce dépôt affirme qu'il est plus petit ;
- **deux machines mesurant le même commit publiaient des rapports B/A différents**, sans qu'aucune des deux ne corresponde à la sortie réelle de l'outil.

C'est ce qui explique que les totaux publiés le 2026-08-01 (**16 861 → 17 538, B/A 54 % → 56 %**) **ne se reproduisent pas** sur ce dépôt : mesuré à `HEAD` avec le harnais corrigé, le même code donne **16 038, B/A 51 %**. L'écart est un décalage constant par cible, pas une régression — et **les deltas publiés en P2 restent justes**, la constante s'annulant dans une différence : les `+38 à +83 caractères` par cascade de corpus sont mesurés à nouveau à l'identique. Ce sont les **valeurs absolues et les rapports** de ce tableau-là qui étaient contaminés, pas ses conclusions.

Corrigé le 2026-08-02 ; tous les chiffres ci-dessous sont post-correction et reproductibles depuis n'importe quel chemin de checkout.

### Le coût de 2307, mesuré

Même harnais, mêmes 25 cibles, seule variable l'enregistrement de `2307` dans la table des enrichisseurs.

| | B chars, sans 2307 | B chars, avec | delta | B/A sans | B/A avec |
|---|---:|---:|---:|---:|---:|
| **total, 25 cibles** | 16 038 | 16 635 | **+3,7 %** | **51 %** | **53 %** |
| `wrong-tsconfig-paths` | 639 | 854 | +215 | 134 % | 179 % |
| `yarn-pnp-project` | 483 | 654 | +171 | 146 % | 198 % |
| `phantom-dependency-pnpm` | 454 | 615 | +161 | 150 % | 203 % |
| `two-independent-roots` | 423 | 473 | +50 | 190 % | 212 % |
| **les 21 autres cibles** | — | — | **0** | — | — |

**Le chiffre à lire en premier : le coût est nul sur les cinq cascades de corpus.** Aucune n'est une cascade de module — ce sont des cascades de type. 2307 ne se paie que là où il parle, ce qui est la propriété qu'on veut d'un enrichisseur sélectif, et **c'est aussi la limite honnête de ce jalon** : sa valeur n'est mesurée sur aucun code réel, seulement sur trois fixtures d'installateur. Le corpus figé n'en contient pas, et en fabriquer un serait une fixture de plus, pas une mesure.

**Le pliage paie encore la facture, et cette fois on peut le chiffrer exactement.** Sur `phantom-dependency-pnpm`, les deux lignes de fait pèsent 160 caractères et le delta mesuré est de +161 : elles sont rendues **une fois** pour trois importateurs. Ungrouped — c'est-à-dire sous `--all` — les mêmes deux lignes coûteraient 480. Le rapport 3:1 est la remontée des faits vers l'en-tête de groupe, et sa condition est l'intersection sur *tous* les membres (PROJECT.md §6).

`two-independent-roots` est le cas sans amortissement : son TS2307 est seul, donc son unique fait (`no node_modules directory at the project root`) se paie plein tarif, +50 caractères sur un rapport de 423. C'est le comportement attendu d'un diagnostic isolé, et c'est aussi pourquoi le rapport B/A d'un témoin négatif se dégrade — il n'a rien à replier, par construction.

### Ce que les trois fixtures rendent, et pourquoi c'est la bonne réponse dans les trois cas

Une seule phrase de TypeScript, trois vérités différentes derrière — le constat pour lequel les fixtures d'installateur avaient été committées le 2026-07-28, enfin exploité :

| fixture | ce que TypeScript dit | ce que la sortie ajoute |
|---|---|---|
| `wrong-tsconfig-paths` | `Cannot find module '@domain/order'` | `matches the tsconfig 'paths' pattern '@domain/*', mapped to 'src/lib/*', baseUrl '.'` |
| `phantom-dependency-pnpm` | `Cannot find module 'qs'` | `'qs' is not declared in … package.json` · `installer: pnpm (pnpm-lock.yaml)` |
| `yarn-pnp-project` | `Cannot find module '@acme/http'` | `'@acme/http' is declared in dependencies … as '1.2.0'` · `installer: yarn (yarn.lock); '.pnp.cjs' at the project root, and no node_modules directory` |

`wrong-tsconfig-paths` est le seul endroit du produit où une cause est nommée **hors de tout fichier du programme** : une ligne de `tsconfig.json`, qu'aucun `declaredAt` ne peut atteindre. Et `yarn-pnp-project` est le cas où le fait le plus utile est celui qui **réfute** la lecture par défaut : le paquet *est* déclaré, *est* verrouillé, *est* installé — ce sont trois imports que seul le mode de lancement rend irrésolus.

### Trois choses qui ne sont pas dites, sur décision

1. **Rien sur ce qui est réellement posé sur le disque.** `qs` est bien présent dans `phantom-dependency-pnpm`, un cran plus bas sous `node_modules/.pnpm/qs@6.11.2/`, et le dire serait la ligne la plus utile de tout ce jalon. Elle n'est pas dite : l'atteindre demande soit de parcourir la topologie **privée** de pnpm — une convention, pas un fichier déclaratif (règle 10) —, soit de parser `pnpm-lock.yaml`, donc d'introduire un parseur YAML, donc la **première dépendance runtime du projet**, pour un seul code. L'installateur et la déclaration manquante sont rendus à la place ; entre les deux le cas est identifiable, et chaque mot est vérifiable contre un fichier.
2. **Rien sur ce que chaque installateur fait d'un paquet non déclaré.** Que le hoisting le rende joignable sous npm et que la topologie de pnpm ne le rende pas est vrai, documenté — et n'est pas un fait *sur ce projet-ci*. C'est là qu'un fait devient une explication, et une explication est à un pas d'une prescription (règle 1).
3. **Rien du tout quand le manifeste n'a pas pu être lu.** `two-independent-roots` n'a pas de `package.json` : « non déclaré » serait une affirmation sur un fichier jamais ouvert. Seule survit l'observation qu'aucun `node_modules` n'est là. `ResolutionFacts.dependencies` est **absent** plutôt que vide exactement pour rendre cette distinction représentable (règle 5).

### Vérification

`typecheck`, **534 tests** (518 avant ce jalon), `check` — tous verts. Les **8 snapshots** régénérés ont été relus : le diff est **purement additif**, 24 insertions et 0 suppression, et ne touche que les quatre cibles portant un TS2307. Les deux témoins négatifs gardent leur compte d'entrées.

---

## P2 / 2739 · 2741 — la mesure qui a corrigé §5.2 (2026-08-02)

Huitième et neuvième codes enrichis. Mais l'essentiel de ce jalon n'est pas dans
l'enrichissement : c'est une **entrée dans `CONTEXT_CAPTURE_CODES`**, donc un
gain de **causalité**, et c'est une mesure faite avant d'écrire une ligne qui a
révélé que §5.2 se trompait de code.

### TS2739 ne tronque pas. TS2740 tronque, et il n'est pas dans la table des dix

§5.2 demande à 2739/2741 « la liste exacte des manquants, sans le reste du
type », au motif explicite que TypeScript tronque la sienne. Sondé sur 5.9.3
avec une interface de 1 à 8 propriétés manquantes :

| propriétés manquantes | code émis | liste |
|---:|---|---|
| 1 | **TS2741** | la nomme (`Property 'p0' is missing …`) |
| 2 | TS2739 | `p0, p1` |
| 3 | TS2739 | `p0, p1, p2` |
| 4 | TS2739 | `p0, p1, p2, p3` |
| 5 | TS2739 | `p0, p1, p2, p3, p4` |
| 6 | **TS2740** | `p0, p1, p2, p3, and 2 more.` |
| 7 | **TS2740** | `p0, p1, p2, p3, and 3 more.` |
| 8 | **TS2740** | `p0, p1, p2, p3, and 4 more.` |

**La troncature décrite par §5.2 appartient à TS2740, qui n'est pas dans sa
table des dix.** Pour 2739 et 2741, la liste est déjà complète à l'écran, et la
répéter serait exactement ce que `facts.ts` interdit : un fait qui redit le
message. Le payload que §5.2 leur attribuait n'existe donc pas pour eux.

C'est le troisième cas où une table a désigné le mauvais code (après 2724 trouvé
par la fixture, et 2769 rétrogradé par `chain`), et le troisième où la règle
d'AGENTS.md a payé : **avant d'ajouter un code à une table, vérifier sur une
fixture réelle lequel sort vraiment.**

### Ce que ces deux codes apportent vraiment : une cause partagée

Le type cible (`Rect`, `Profile`) est nommé dans chacun de ces messages et
**jamais situé**. Or c'est une cause partagée : N sites de construction d'une
interface cassent ensemble le jour où elle gagne un membre requis. Les deux
codes entrent donc dans `CONTEXT_CAPTURE_CODES`, et le gain est un gain de §5.1.

Deux formes de nœud arrivent au résolveur, mesurées avant implémentation :

| forme | occurrences | ce qui résout |
|---|---:|---|
| nom d'une `VariableDeclaration` (`const origin: Rect = { … }`) | 4/6 | `getTypeAtLocation` **est** déjà le type cible |
| `ReturnStatement` (`return { x, y }`) | 2/6 | le type de retour de la signature englobante — `getTypeAtLocation` y rend `any` |

La seconde branche n'est pas une optimisation : sans elle, 2 diagnostics sur 6
ne résolvent rien, et une cascade plierait 2 sites sur 3 — **pire que ne pas
plier**, le membre resté dehors se lisant comme une seconde cause. Avec les
deux : **6/6, un `declaredAt` par fixture.**

### Le résultat, mesuré

| | sans capture 2739/2741 | avec | delta |
|---|---:|---:|---:|
| **total, 25 cibles** | 16 635 | 16 948 | **+1,9 %** (B/A 53 % → 54 %) |
| **entrées rendues** | 52 | **48** | **−4** |
| `missing-required-property` | 732 (3 entrées) | 896 (**1 entrée**) | +164 |
| `missing-multiple-properties` | 506 (3 entrées) | 655 (**1 entrée**) | +149 |

**Pliage à cause unique : 8/17 → 10/17.** Le lien structurel `declaredAt`
identique passe de cinq à sept fixtures.

**Et les caractères montent alors que les entrées baissent — c'est attendu, et
il faut le dire plutôt que de le cacher.** C'est le même effet que sur
`partial-interface-rename` : sous le plafond d'affichage de trois sites, les
trois diagnostics s'impriment encore et l'en-tête de cause s'ajoute par-dessus.
**Le gain est structurel, pas volumétrique** — sur une fixture de trois erreurs,
`tsc` n'a pas de problème de bruit. Ce que ces deux fixtures démontrent est que
le lien existe et se capture ; ce qu'elles ne démontrent pas est une économie,
et aucune cascade de corpus ne porte ces codes pour le trancher.

### Un test qui a fait son travail

`test/causality.test.ts` portait depuis P1 une assertion `groups: []` sur
`missing-required-property`, avec en commentaire : *« ces tests existent pour
que, le jour où la capture est étendue, le changement apparaisse comme un échec
ici plutôt que comme une amélioration silencieuse que personne n'a mesurée. »*
Il a échoué exactement comme prévu. Il est réécrit pour enregistrer le pliage —
et il garde sa moitié la plus tranchante : **le pliage se fait sur l'interface
(`profile.ts:7:1`), pas sur le `related` (`profile.ts:10:3`)**. Deux positions
distinctes, donc la question 2 du plan P1 reste close dans le sens où
`assignability-mismatch` l'avait close.

### Vérification

`typecheck`, **539 tests** (534 avant), `check` — verts. **4 snapshots** relus :
les deux fixtures passent de 3 entrées à 1, et sous `--all` chaque diagnostic
porte sa ligne `required by:`. 23 insertions, 15 suppressions — les suppressions
sont les lignes `[2]`/`[3]` que le pliage remplace, pas des diagnostics perdus
(`--all` les restitue tous, règle 2).

---

## P2 / 2740 — le code que §5.2 décrivait sans le nommer (2026-08-02)

Ajouté à la table de §5.2 **sur décision humaine**, la règle d'AGENTS.md
interdisant d'y faire entrer un code sans la demander. La mesure de la section
précédente avait montré que la troncature attribuée à 2739/2741 appartient à
2740 ; c'est donc le seul endroit où « la liste exacte des manquants » est une
information que le lecteur n'a pas déjà.

### Ce qu'il rend

Une fixture, `missing-many-properties`, seule à émettre ce code — trois sites
construisant un `ShipmentLabel` à six champs près. Identique sous **5.4.5 et
5.9.3** : trois TS2740, quatre membres nommés, `and 2 more.`

```
[1] cause: interface 'ShipmentLabel' declared at src/shipping/label.ts:5:1
      8 properties: carrier, tracking, weightGrams, originPostcode, destinationPostcode, service, insuredCents, signatureRequired
      2 more not listed above: insuredCents, signatureRequired
    3 diagnostics, all TS2740
    …
```

**La complétion est calculée par soustraction contre le message verbatim**, et
non en prenant `missing.slice(4)`. La queue n'est la bonne réponse que si
TypeScript imprime dans l'ordre de `getPropertiesOfType` — une supposition sur
ses internes, pas une vérification. La comparaison à ce qui a réellement été
imprimé tient quel que soit son ordre, et dégrade en « ne rien ajouter » s'il
cesse un jour d'imprimer des noms.

*(La ligne `8 properties:` et la ligne de complétion se recouvrent
partiellement — les deux noms apparaissent deux fois. C'est le prix d'une règle
uniforme : l'en-tête décrit le type cause pour **tout** code pliant sur une
déclaration, et lui faire une exception ici coûterait plus en cas particulier
qu'en caractères.)*

### Coût : nul sur les cibles préexistantes

| | 25 cibles | 26 cibles |
|---|---:|---:|
| avant 2740 | 16 948 | — |
| après 2740 | **16 948** | 18 010 |

`18 010 − 1 062 = 16 948` exactement : la fixture nouvelle est la seule ligne
qui bouge, et aucune des vingt-cinq autres ne coûte un caractère de plus. Le
rapport global passe de 54 % à 56 % **uniquement** parce qu'une cible s'ajoute,
et cette cible-là plie 3 diagnostics en 1 pour 157 %.

### Une hypothèse du renderer que ce code a fait tomber

Depuis le 2026-08-01, la suppression des faits d'un membre de groupe était
**tout ou rien**, au motif — écrit dans le code — que *« les faits d'un
diagnostic décrivent tous le seul symbole que son contexte a résolu, donc si la
déclaration est parmi eux, l'ensemble est ce que l'en-tête a déjà dit »*.

**2740 réfute la prémisse.** Sa ligne `2 more not listed above: …` est une
propriété de la *panne*, pas du type cible : aucun `SymbolRef` ne peut la
produire, donc aucun en-tête ne l'avait dite. Sous l'ancienne règle elle était
supprimée dans le **rendu par défaut** et ne survivait que sous `--all` —
l'enrichissement absent exactement de la vue pour laquelle il est écrit.

La règle est maintenant **fait par fait**, contre ce que l'en-tête a réellement
imprimé : égalité, **ou suffixe**. Le suffixe est ce qui reconnaît
`'CreateUserInput' has 3 properties: id, email, name` et l'en-tête
`3 properties: id, email, name` comme la même liste écrite deux fois, sans coder
en dur ni l'une ni l'autre formulation. Et ce qui reste commun à tous les
membres sans avoir été dit remonte **une fois** sur l'en-tête, comme pour les
groupes `module`.

**La refonte est neutre, et le snapshot le prouve : 32 insertions, 0
suppression.** Aucune des vingt fixtures préexistantes ne change d'un caractère,
ce qui est la démonstration que la règle du suffixe reproduit l'ancienne partout
où elle s'appliquait.

### Vérification

`typecheck`, **560 tests** (539 avant), `check`, et `fixtures:verify` sur **21**
fixtures — verts. La fixture nouvelle émet 3 × TS2740 sous 5.4.5 comme sous
5.9.3, seuil de troncature compris.

---

## P2 / 2322 — le dernier code enrichissable, et pas pour la raison annoncée (2026-08-02)

§5.2 demande à 2322 « le chemin de divergence (`a.b[0].c`) ». Il reste non
dérivable : il faudrait les deux types comme structures, et seul l'attendu est
capturé. **Ce qui l'est valait davantage** — où le type cible est déclaré, et,
pour une union, ce qu'il autorise réellement.

`Type '"GBP"' is not assignable to type 'Currency'.` nomme le type au nom
duquel la valeur est refusée, et ne dit ni où `Currency` vit, ni qu'il vaut
`"EUR" | "USD"`. Les deux sont à un survol de souris dans un éditeur et
inatteignables depuis un terminal — la définition même, dans ce projet, d'un
fait qui vaut ses tokens.

### Le résultat le plus net du jalon : la fixture anti-`related` plie correctement

`assignability-mismatch` a été écrite pour **interdire** une règle : indexer sur
le span d'un `relatedInformation`. Deux de ses trois diagnostics portent un
`related` désignant `currency.ts:9:3` — la *propriété* `currency` de `Rate`, du
code parfaitement correct — et le troisième n'en porte aucun.

Résolu sur le **type contextuel**, les trois atterrissent sur
`currency.ts:6:1`, `type Currency`, la ligne que `meta.json` nomme cause racine.

| clé | atteint | où |
|---|---:|---|
| span du `related` | 2 / 3 | `currency.ts:9:3` — code correct, à ne pas toucher |
| **type contextuel** | **3 / 3** | **`currency.ts:6:1` — l'union qui a perdu `"GBP"`** |

La fixture porte donc désormais les **deux** moitiés de l'argument au lieu
d'une : le `related` est la mauvaise clé, *et* le type contextuel en est une
bonne. Rendu :

```
[1] cause: type-alias 'Currency' declared at src/pricing/currency.ts:6:1
      "EUR" | "USD"
    3 diagnostics, all TS2322
```

### Une inversion mesurée : objet vs primitif

P2 avait établi que pour un type **objet nommé**, `typeToString` rend le nom et
c'est la **liste des propriétés** qui porte l'information. Pour une union de
**primitifs**, c'est l'exact inverse :

| type | `typeToString` | `getPropertiesOfType` | ce qui informe |
|---|---|---|---|
| `interface CreateUserInput` | `CreateUserInput` (le nom) | `id, email, name` | **les propriétés** |
| `type Currency = "EUR" \| "USD"` | `Currency` (le nom) | **50 membres de `String`** — `charAt`, `blink`, `fontcolor` | **les constituants** |

Aucune des deux ne se généralise, d'où un test sur le type (`hasOwnMembers`)
plutôt qu'une règle unique. Vérifié dans les deux sens : `narrowed-union-member`
— une union d'**objets**, où la liste commune est l'information — sort **au
caractère près** comme avant, et une version intermédiaire qui expansait toutes
les unions lui infligeait 130 caractères de littéraux d'objet à la place de
`1 property: type`, qui est la ligne qui répond vraiment à « pourquoi `.kind`
n'existe pas sur Shape ».

### Un garde étendu, et une règle 1 qui a sonné juste

Capturer 2322 a produit le premier cas d'un type attendu **hors du programme** :
`unconstrained-generic` résout vers `Map` dans `lib.es2015.collection.d.ts`. Ce
qui sortait :

```
expected type: interface 'Map' Map<string, User> at <ts-lib>/lib.es2015.collection.d.ts:19:1
'Map' has 12 properties: clear, delete, forEach, get, has, set, size, …, __@iterator@2156
```

Vrai, vérifiable, et sans valeur pour le lecteur d'un échec d'inférence
générique — plus deux noms internes (`__@iterator@2156`) dont l'identifiant
change d'une compilation à l'autre. **Et le test de non-prescription de la
règle 1 a échoué dessus**, sur `set` et `delete`, membres de `Map` : le test
n'avait pas tort, la sortie n'avait rien à faire là.

Deux corrections, toutes deux générales :
- **un enrichisseur ne décrit jamais une déclaration hors des fichiers du
  programme** — même autorité que §5.1 pour une cause, `ProgramFacts.files`,
  tout ou rien puis repli natif (règle 5) ;
- **les noms de symboles bien connus (`__@…`) sont filtrés** de `memberNames`,
  pour la même raison que `displayName` refuse `__type`.

### Coût

| | entrées | B chars | B/A |
|---|---:|---:|---:|
| avant 2322 | 49 | 18 010 | 56 % |
| après | **47** | 18 150 | 57 % |

**+140 caractères, −2 entrées.** Le seul poste qui bouge est
`assignability-mismatch`, 284 → 753 (265 %) : trois diagnostics repliés en une
entrée, plus l'en-tête et la ligne d'union. Comme les autres petites fixtures,
le gain y est **structurel et non volumétrique**.

**Pliage à cause unique : 12 sur 18** — contre 8 sur 17 en début de journée. Le
lien `declaredAt` identique porte neuf fixtures, le spécificateur partagé trois.

### Ce que 2322 ne plie pas, et c'est correct

`unconstrained-generic` porte un TS2322 et **ne plie pas** : son type attendu est
`Map`, hors programme, et le garde le refuse. C'est le comportement voulu — la
fixture est le témoin des diagnostics *sur* leur propre cause — et c'est aussi
le rappel que capturer un code ne fait pas plier tous ses diagnostics.

### Vérification

`typecheck`, **560 tests**, `check` — verts. Diff de snapshot : **12 insertions,
8 suppressions, sur la seule `assignability-mismatch`**. Toutes les autres
fixtures, `narrowed-union-member` et `unconstrained-generic` comprises, sortent
au caractère près comme avant — la démonstration que les corrections apportées à
`symbolRefOfType` sont ciblées et non des effets de bord.
