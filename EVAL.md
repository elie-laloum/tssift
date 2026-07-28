# EVAL — mesures

**Dernière mise à jour :** 2026-07-28 (T1 de B1 — règle 2307 écrite, pliage à 8/17)
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

**Conséquence sur tssift lui-même, à écrire dans le README plutôt qu'à découvrir dans une issue : tssift est un processus Node nu.** Sous un projet PnP il produira exactement cette sortie — trois erreurs plausibles et entièrement fausses — s'il n'est pas lancé au travers du runtime (`yarn tssift`). C'est le mode de défaillance le plus coûteux imaginable pour un outil dont l'argument est « faites confiance à la hiérarchisation » : rien n'est signalé, la sortie a l'air normale. La règle 15 interdit le repli silencieux ; il faudra décider si détecter un `.pnp.cjs` sans `process.versions.pnp` relève de la sortie 2.

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
