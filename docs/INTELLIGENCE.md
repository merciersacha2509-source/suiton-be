# SUITON Intelligence

Le logiciel propose, le dirigeant décide, le résultat est mesuré.

---

## Ce que ce module refuse de faire

Il ne modifie **jamais** la grille tarifaire. Aucune fonction n'écrit dans
`settings`. Un système qui ajusterait les prix tout seul serait une boîte
noire à laquelle on finirait par obéir sans comprendre.

Il ne produit **aucun chiffre de gain unique**. « Vous gagnerez 2 400 € » sur
six chantiers est un mensonge. Chaque recommandation porte une **fourchette**,
et l'écart entre les deux bornes est l'information la plus utile :

- **borne basse** — la moitié des clients refuse la hausse ;
- **borne haute** — tous l'acceptent.

Il ne recommande **rien sous 5 chantiers comparables**. Une mauvaise
recommandation coûte plus cher qu'aucune : elle fait perdre de l'argent avec
assurance, et discrédite toutes les suivantes.

---

## Les cinq familles

| Famille          | Ce qu'elle détecte                            | Gain calculé sur                                    |
| ---------------- | --------------------------------------------- | --------------------------------------------------- |
| **Tarification** | Segments à CA horaire ≥ 12 % sous la moyenne  | Écart × volume annuel × taux d'acceptation 50–100 % |
| **Planning**     | Sureffectif sur petites surfaces              | Heures perdues × CA horaire                         |
| **Prospection**  | Communes à CA horaire ≥ 12 % au-dessus        | Surplus horaire × durée moyenne × 5 à 15 chantiers  |
| **Qualité**      | Service concentrant ≥ 40 % des retouches      | Retouches évitées × 2 h non facturées               |
| **Productivité** | Étapes dont le p90 dépasse la médiane de 80 % | Minutes récupérables × CA horaire                   |

### Deux calibrages qui comptent

**La hausse recommandée est plafonnée à 15 %.** Un segment à 40 % sous la
moyenne ne déclenche pas une recommandation de +40 % : au-delà de 15 %, on ne
recommande plus, on **suggère une expérience contrôlée**. Une hausse de 30 %
annoncée comme sûre sur huit chantiers est une façon rapide de perdre un
segment entier.

**Le volume annuel n'est pas extrapolé sous 60 jours d'historique.** Projeter
une année depuis trois semaines donnerait des chiffres absurdes. En dessous,
le gain est calculé sur le volume déjà réalisé — et annoncé comme un plancher.

---

## Priorisation par ROI

Le classement multiplie le **gain minimal** — jamais le maximal — par un poids
de confiance et un poids d'urgence.

| Confiance     | Poids | Effet           |
| ------------- | ----- | --------------- |
| élevée (25+)  | 1     | —               |
| bonne (10–24) | 0,7   | —               |
| moyenne (5–9) | 0,4   | divisé par 2,5  |
| faible (3–4)  | 0,15  | quasi éliminé   |
| aucune        | 0     | jamais proposée |

Classer sur le gain maximal placerait en tête les paris les plus optimistes.
Le poids de confiance écrase délibérément les recommandations mal fondées :
mieux vaut rater une opportunité que d'engager une hausse tarifaire sur du
bruit.

---

## Explicabilité — aucune boîte noire

Chaque recommandation porte **deux blocs** dépliables :

**Ce que disent vos chantiers** — les chiffres observés, le calcul du gain
ligne par ligne.

**Ce que le calcul suppose** — les hypothèses qui pourraient être fausses.
Pour une hausse tarifaire, la première est nommée explicitement : _« Le volume
ne baisse pas après la hausse. C'est l'hypothèse la plus fragile : un client
sur deux peut refuser. »_

Une recommandation qu'on ne peut pas contester finit par être suivie
aveuglément ou ignorée. Les deux sont mauvais.

---

## Expériences contrôlées

C'est la partie la plus honnête du système : plutôt qu'affirmer qu'une hausse
passera, on la **teste**.

La période de référence est prise **juste avant, sur la même durée**.
Comparer trois mois d'hiver à six mois d'été mesurerait la saison, pas
l'expérience.

### Trois raisons de refuser de conclure

1. **Échantillon insuffisant** — moins de 5 chantiers d'un côté ou de l'autre.
2. **Écart sous 10 %** — c'est du bruit.
3. **Recouvrement interquartile** — si la moitié centrale des deux échantillons
   se chevauche, les distributions ne sont pas distinguables, quelle que soit
   la différence des médianes.

Le troisième point est celui qu'on oublie le plus souvent, et celui qui
produit les fausses conclusions les plus coûteuses.

Une expérience qui se termine sur « on ne peut pas savoir » a plus de valeur
qu'une expérience qui conclut à tort — parce que la seconde fait prendre une
décision, et cette décision sera fausse.

Sur une dégradation douteuse, le module tranche par la prudence : _« Arrêtez
par prudence : un doute sur une perte se tranche en revenant en arrière. »_

---

## Traçabilité des décisions

Les recommandations sont **déterministes** : le moteur les recalcule à chaque
affichage. La table `recommandations` ne stocke donc pas les recommandations,
mais les **décisions** prises à leur sujet.

Un rejet exige un **motif**. Sans lui, dans six mois, on ne saura plus si
c'était une mauvaise idée ou juste le mauvais moment. Une recommandation
écartée n'est plus reproposée.

Le contexte du raisonnement est figé au moment de la décision : c'est la seule
façon de juger après coup si elle était raisonnable **avec les données de
l'époque**.

---

## Architecture

```
lib/recommandations.ts   moteur pur — 5 familles, ROI, priorisation
lib/experiences.ts       analyse avant/après, refus de conclure
app/(app)/intelligence/  page, actions de décision et d'expérimentation
```

Deux modules **purs** : aucune requête, aucune dépendance serveur. Ils
reçoivent les agrégats des vues SQL et produisent des phrases. D'où 34 tests
qui tournent en 100 ms.

Nouvelles vues : `saisonnalite`, `volume_par_segment` (avec profondeur
d'historique, pour que l'appelant sache ce que vaut son extrapolation).
Nouvelle fonction : `mesurer_experience()` — elle fournit les faits, jamais
l'interprétation, qui vit dans le code où elle est testable.

---

## Vérification

```bash
npm run verify    # types + lint + 195 tests + build
npm run test:db   # 75 assertions contre PostgreSQL
```

Les assertions couvrent les garde-fous : rejet sans motif refusé, fourchette
de gain inversée refusée, période de test antérieure à la référence refusée,
clôture sans conclusion refusée, et exclusion des checklists suspectes de
toute mesure d'expérience.

Non vérifié ici, faute de navigateur : le rendu des cartes de décision et le
parcours complet accepter / écarter / expérimenter.

---

## Ce qui reste

Le module suppose que les **retouches** sont enregistrées — la colonne existe
(`job_metrics.retouches`) mais rien ne l'alimente encore. Tant qu'elle reste à
zéro, la famille « qualité » ne produira aucune recommandation.

C'est le prochain maillon : un bouton « retouche effectuée » sur la fiche
chantier, qui incrémente le compteur et enregistre le motif.
