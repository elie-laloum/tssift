# EVAL — mesures

**Dernière mise à jour :** 2026-07-27
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

## Résultats — 2026-07-27, P0

Chiffres obtenus par deux exécutions consécutives donnant un résultat **identique**, sans avertissement de l'arbre de travail.

| cible | type | ts | A diags | B diags | A car. | B car. | B/A car. | A ~tok | B ~tok |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| partial-interface-rename | fixture | 5.9.3 | 3 | 3 | 523 | 697 | **133 %** | 131 | 174 |
| two-independent-roots | fixture | 5.9.3 | 2 | 2 | 223 | 319 | **143 %** | 56 | 80 |
| overload-mismatch | fixture | 5.9.3 | 1 | 1 | 571 | 1176 | **206 %** | 143 | 294 |
| lekes | dépôt réel | 5.9.3 | 8 | 8 | 1475 | 1877 | **127 %** | 369 | 469 |
| tccp | dépôt réel | 5.9.3 | 0 | 0 | 0 | 40 | n/a | 0 | 10 |
| keyzia/data-explorer | dépôt réel | 5.8.3 | 0 | 0 | 0 | 72 | n/a | 0 | 18 |
| nextp/cursor-rules-hooks | dépôt réel | 6.0.3 | — | — | — | — | **refusé, sortie 2** | — | — |
| corpus/lekes-result-value-renamed | corpus | 5.9.3 | 112 | 112 | 18 548 | 19 102 | **103 %** | 4 637 | 4 776 |
| corpus/lekes-task-export-renamed | corpus | 5.9.3 | 12 | 12 | 1 677 | 1 804 | **108 %** | 419 | 451 |
| corpus/lekes-ok-arity-changed | corpus | 5.9.3 | 153 | 153 | 17 602 | 32 025 | **182 %** | 4 401 | 8 006 |

**Totaux sur les 9 cibles mesurées : diagnostics A = 283, B = 283. Caractères A = 39 144, B = 55 276, soit B/A = 141 %.**

### Le corpus réel confirme l'hypothèse du coût fixe

Les trois entrées `corpus/` sont du **vrai code** (`lekes`, 169 fichiers TS), figé à un commit épinglé, cassé par une mutation d'une ligne. Détail et méthode : `eval/corpus.json`.

Sur les deux cascades à cause unique et large, le surcoût **s'effondre** : **103 %** et **108 %**. C'est la confirmation directe de ce que la tendance des fixtures laissait deviner — l'essentiel du surcoût de P0 est **fixe** (en-tête, préfixes de code), donc il se dilue dès que le rapport grossit. Sur les cibles qui ressemblent au cas d'usage réel, `agent-text` coûte aujourd'hui **3 à 8 % de plus** que `tsc` brut, pas 106 %.

**L'exception à 182 % (`lekes-ok-arity-changed`) est instructive et a été vérifiée.** 152 de ses 153 diagnostics portent un `relatedInformation` — *« An argument for 'origin' was not provided. »* pointant `src/shared/domain/result.ts:15:33` — que `tsc --pretty false` n'imprime **pas du tout**. Le surcoût est donc, à 100 %, de l'information ajoutée, répétée 152 fois.

Et cette information n'est pas décorative : **chacun de ces 152 related désigne la déclaration qui est la cause racine.** C'est un lien structurel, présent dans les données capturées, exactement du type que PROJECT.md §5.1 autorise à exploiter — et c'est P1 qui devra décider s'il s'en sert pour dériver, puis replier ces 152 lignes en une racine et un compteur.

⚠️ **Ne pas citer le total seul.** Il est dominé par la cible la plus grosse, et il bouge donc avec elle sans rien dire du produit : au cours de la même session, avec un `lekes` plus cassé, ce même total valait 124 %. **Les rapports par cible et leur tendance avec la taille sont les seuls chiffres lisibles ici.**

---

## Lecture honnête

**Le gain de P0 est nul sur les diagnostics et négatif sur les caractères.** Même nombre de diagnostics des deux côtés — 14 contre 14 — et une sortie 27 % à 106 % plus grosse selon la cible.

Ce n'est pas une contre-performance, c'est le résultat attendu et annoncé (`.plans/2026-07-27_p0-b0.md` § T9, PROJECT.md §6) : **en P0 il n'y a ni causalité ni enrichissement.** Le bras B contient exactement les mêmes diagnostics que le bras A, seulement reformatés et annotés. Le pliage des cascades — le mécanisme qui porte H1 — arrive en **P1**. Ce tableau est la **ligne de base contre laquelle P1 se mesurera**, pas une démonstration de quoi que ce soit.

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
