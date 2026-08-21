# Cockpit du dirigeant

La vue qui transforme les données en décisions.

---

## Ce que le cockpit refuse de faire

Il ne montre jamais un chiffre sans son assise. Une médiane sur trois
chantiers a exactement la même apparence qu'une médiane sur cent — et c'est
ainsi qu'on repricie une gamme entière sur un hasard.

Trois garde-fous, appliqués sans exception :

| Garde-fou                | Règle                                                                    |
| ------------------------ | ------------------------------------------------------------------------ |
| **Seuil d'observations** | Aucune alerte sous 5 chantiers comparables                               |
| **Amplitude minimale**   | Aucune alerte sous 12 % d'écart                                          |
| **Plafond**              | 6 alertes maximum — au-delà, la liste devient un mur qu'on cesse de lire |

Une alerte fausse coûte plus cher qu'une alerte absente : elle fait perdre
confiance dans toutes les autres.

---

## Les neuf blocs

### 1 — Performance

Huit indicateurs sur 90 jours, avec évolution contre les 90 précédents.
Cadence, CA horaire, précision d'estimation, taux de retouche, couverture
photo, note, délai de signature, délai de paiement.

L'évolution n'apparaît **que** s'il existe une période précédente comparable.
Sinon on afficherait « +∞ % » sur un premier trimestre.

Chaque indicateur porte son interprétation — ce que le chiffre signifie, pas
seulement ce qu'il vaut. _« Le seul chiffre qui compare un petit chantier
rapide à un gros chantier lent. »_

### 2 — Alertes actionnables

Placées **en premier**, avant les indicateurs : c'est ce qui appelle une
décision aujourd'hui.

Sept règles, toutes déduites des vues SQL :

- **Écart tarifaire par segment** — la plus rentable. _« Les maisons de 110 à
  180 m², salissure standard, rapportent 25 % de moins à l'heure que votre
  moyenne. Panier médian 1 200 €. Relevez la grille, ou refusez-les : à ce
  rythme ils occupent des journées qui rapporteraient plus ailleurs. »_
- **Sureffectif** — compare la cadence réelle à 1, 2, 3 techniciens plutôt
  que de postuler une règle.
- **Concentration des retouches** — au-delà de 40 % sur un service.
- **Communes** — à la hausse comme à la baisse, avec la récurrence.
- **Précision d'estimation** — sous 60 %, la grille ne décrit plus la réalité.
- **Couverture photo** — sous 70 %, la promesse commerciale n'est pas tenue.
- **Checklists cochées après coup** — dès la première. Ce n'est pas une
  tendance mais un défaut de procédure, et il fausse la base de référence de
  façon permanente.

Quand aucune alerte ne sort, le bloc **dit pourquoi** : « aucun chantier »,
« pas assez par segment », ou « aucun écart significatif — votre grille
correspond à votre réalité ».

### 3 — Où part le temps

Médiane **et** p90 sur la même barre. La médiane dit le cas courant, le p90
dit ce qui dérape. La moyenne seule masquerait précisément les étapes qui
explosent de temps en temps — celles qu'il faut corriger.

### 4 — Matrice de rentabilité

CA horaire médian par service × bande de surface. L'intensité de fond encode
la valeur, **sauf sous 5 observations** : ces cellules restent grises. Une
couleur forte sur deux chantiers dirigerait le regard vers du bruit.

### 5 — Références · `/donnees/references`

Les 105 gabarits (7 biens × 5 bandes × 3 salissures), avec durée de référence,
fourchette interquartile, prix médian, nombre de chantiers et **origine**.

La colonne « origine » est la plus importante : elle dit si le chiffre vient
de l'expérience ou du catalogue. Les lignes teintées reposent sur vos
chantiers réels.

« Voir » ouvre les chantiers comparables — mêmes bien, bande et salissure —
avec les chantiers exclus signalés.

### 6 — Estimation · `/donnees/estimation`

Service, bien, surface, code postal, salissure, techniciens, urgence → durée,
prix recommandé, CA horaire attendu, confiance, alertes.

**Le prix n'est proposé qu'à partir de 5 chantiers comparables.** En dessous,
le champ affiche « — » et la raison. Suggérer un prix sur trois chantiers
reviendrait à ancrer la tarification sur du bruit.

La grille tarifaire actuelle est rappelée à côté : c'est ce que le
calculateur public annonce, et l'écart entre les deux est en soi une
information.

### 7 — Où prospecter

Communes classées par CA horaire, avec panier, taux de retour et confiance.
Une commune rentable est une commune où l'on gagne bien sa journée **et** où
l'on revient.

### 8 — Équipes

Comparaison **uniquement** si au moins deux équipes atteignent 5 chantiers.
Sinon : « Données insuffisantes — en dessous, l'écart mesure le hasard des
chantiers attribués, pas l'efficacité. »

La colonne « suspectes » compte les checklists cochées après coup par équipe.

### 9 — Évolution

Par trimestre, jamais par mois : à trois chantiers par mois, une courbe
mensuelle ne montre que du bruit et invite à sur-interpréter.

---

## Architecture

**Aucun calcul côté front.** Huit vues SQL font l'agrégation ; les composants
affichent. C'est la seule façon de garantir qu'un chiffre du tableau de bord
et le même chiffre dans un PDF racontent la même histoire.

```
perf_globale             bloc 1, avec période précédente
ecart_tarifaire          bloc 2 — matière première des alertes
rendement_par_effectif   bloc 2 — sureffectif
retouches_par_service    bloc 2 — concentration
rentabilite_matrice      bloc 4
references_gabarits      bloc 5 — les 105 gabarits
opportunites_communes    bloc 7
evolution_trimestrielle  bloc 9
chantiers_comparables()  fonction — « voir les chantiers derrière ce chiffre »
```

Le moteur d'alertes (`src/lib/alertes.ts`) est **pur** : aucune requête,
aucune dépendance serveur. Il reçoit les agrégats et produit des phrases —
d'où 34 tests qui tournent en 350 ms.

### Poids de page

`/donnees` pèse **114 kB** de JS au premier chargement. Recharts (≈ 96 kB)
est chargé **à la demande**, uniquement quand un graphique est réellement
rendu : le premier jour il n'y a rien à tracer, le charger serait du
gaspillage. Sans ce chargement différé, la page pesait 210 kB.

---

## Vérification

```bash
npm run verify    # types + lint + 160 tests + build
npm run test:db   # 63 assertions contre PostgreSQL
```

Les assertions couvrent explicitement les cas dégradés : `perf_globale`
renvoie toujours exactement une ligne même sans donnée, les 105 gabarits ont
tous une référence exploitable, et les chantiers comparables ne franchissent
jamais la bande de surface.

Non vérifié ici, faute de navigateur : le rendu visuel des graphiques et des
états vides. C'est la première chose à regarder au lancement.
