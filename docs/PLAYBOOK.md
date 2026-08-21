# SUITON Playbook — la boucle fermée

```
observation → recommandation → décision → expérience → mesure → référence
     ↑                                                              │
     └──────────────────────────────────────────────────────────────┘
```

Le maillon qui manquait était l'**exécution**. Une recommandation acceptée qui
ne devient pas une expérience mesurée n'apprend rien : c'est une intention.

Dans SUITON Playbook, **accepter une recommandation lance le test qui la
validera ou l'infirmera.**

---

## Ce que ce module refuse de faire

### Il ne modifie jamais rien

Aucune fonction n'écrit dans la grille tarifaire, le planning ou les
procédures. Même après une expérience concluante, le message final est
explicite : _« Généralisée. Pensez à ajuster la grille tarifaire en
conséquence — le système ne le fait pas pour vous. »_

### Il ne compte pas ce qu'il n'a pas prouvé

C'est le point où un logiciel qui mesure sa propre valeur est le plus tenté
de mentir. Trois règles, appliquées sans exception :

1. **Seules les expériences généralisées portent une valeur.** Une
   recommandation acceptée sans test ne compte pas.
2. **Un résultat positif mais fragile ne produit aucune valeur.** Si les
   moitiés centrales des deux échantillons se chevauchent, le système propose
   de prolonger, et n'attribue rien.
3. **La valeur retenue est celle estimée au moment de la recommandation**,
   jamais recalculée après coup pour coller au résultat.

Et même ainsi, l'écran affiche la réserve : _« Cette valeur ne prouve pas une
causalité : le marché et la saison ont pu jouer. »_

### Il refuse de lancer un test qui ne peut pas conclure

Avant de lancer, le système calcule combien de chantiers le périmètre
produira. Au-delà de **six mois** d'attente nécessaire, le test est déclaré
non viable : le marché, la saison et l'équipe auront changé, et la mesure ne
comparerait plus la même entreprise à elle-même.

> À 0,7 chantier par mois, il faudrait 8 mois pour réunir les 5 chantiers
> nécessaires. Le marché aura changé avant la conclusion — élargissez le
> périmètre plutôt que d'attendre.

---

## La page décisionnelle

Ouvrir un plan (`/playbook?plan=…`) affiche tout ce qu'il faut pour décider :

- **le modèle de playbook** retenu, avec sa méthode ;
- **la durée calculée** depuis le rythme réel du périmètre ;
- **les prérequis** — ce qu'il faut préparer avant de lancer ;
- **les points de vigilance** — ce qu'il faut surveiller au-delà de
  l'indicateur principal ;
- **les chantiers concernés**, cliquables, pour vérifier sur pièces.

### Les trois actions

| Action       | Effet                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| **Accepter** | Crée l'expérience : segment, intervention, durée, indicateur, période de référence, seuils. Prête à mesurer.     |
| **Reporter** | Choisir une date. La recommandation disparaît et réapparaît ce jour-là.                                          |
| **Écarter**  | Motif obligatoire — sans lui, dans six mois, on ne saura plus si c'était une mauvaise idée ou le mauvais moment. |

---

## Les cinq playbooks

Un playbook n'est pas une valeur, c'est une **méthode** : quel indicateur
observer, combien de temps, ce qui doit être vrai pour conclure.

| Playbook               | Indicateur       | Durée | Point de vigilance                                                                                            |
| ---------------------- | ---------------- | ----- | ------------------------------------------------------------------------------------------------------------- |
| **Hausse tarifaire**   | CA horaire       | 60 j  | Le taux d'acceptation. Un CA horaire en hausse avec moitié moins de chantiers est une perte.                  |
| **Nouvelle équipe**    | min/m²           | 90 j  | La couverture photo : un rythme rapide obtenu en sautant des étapes n'est pas un gain.                        |
| **Nouveau matériel**   | min/m²           | 60 j  | La qualité, qui ne doit pas baisser avec la vitesse.                                                          |
| **Nouvelle procédure** | Couverture photo | 90 j  | La durée totale, qui ne doit pas exploser au nom de la qualité.                                               |
| **Nouvelle zone**      | CA horaire       | 120 j | Le trajet ne figure pas dans la durée du chantier : un CA horaire flatteur peut masquer deux heures de route. |

---

## Décision finale

À la fin du test, le système **propose** — les trois options restent ouvertes.

| Mesure               | Proposition                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Ne peut pas conclure | **Prolonger** — « conclure maintenant coûterait une mauvaise décision »                                                  |
| Effet négatif        | **Arrêter**                                                                                                              |
| Aucun effet          | **Arrêter, sans regret** — « le test a répondu : ce levier ne produit rien. C'est une information utile, pas un échec. » |
| Positif mais fragile | **Prolonger avant de généraliser** — aucune valeur attribuée                                                             |
| Positif et net       | **Généraliser** — valeur attribuée, avec sa réserve                                                                      |

---

## Mémoire d'entreprise

Chaque expérience close laisse un récit relisible :

> En mars 2027, nous avons testé +8 % sur les maisons 140–160 m² sur
> maisons · 110–180 m² · Nivelles. CA horaire +11 %, volume stable.
> Décision : généralisé. Valeur estimée : 4 200 € par an.

C'est ce qui transforme une suite de décisions en apprentissage : dans trois
ans, on saura ce qui a été tenté, sur quoi, avec quel résultat — y compris ce
qui n'a pas marché, qui est souvent le plus utile.

---

## Architecture

```
lib/playbook.ts     moteur pur — plans, décision finale, bilan, récits
supabase/           playbook_modeles · experiences étendues
                    valeur_creee · decisions_par_annee · memoire_entreprise
app/(app)/playbook/ page décisionnelle, actions, écran de bilan
```

Le module est **pur** : aucune requête, aucune écriture. 21 tests en 100 ms.

Une migration séparée pour le seul `ALTER TYPE ... ADD VALUE` : PostgreSQL
interdit d'utiliser une valeur d'enum dans la transaction qui l'ajoute, et
l'erreur n'apparaît qu'à l'application — jamais à l'écriture.

---

## Vérification

```bash
npm run verify    # types + lint + 215 tests + build
npm run test:db   # 84 assertions contre PostgreSQL
```

L'assertion la plus importante : _« la valeur d'une expérience arrêtée n'est
PAS comptabilisée »_. Une expérience arrêtée portant une valeur de 9 999 € en
base ne contribue pas au bilan — seules les généralisations comptent.

Non vérifié ici, faute de navigateur : le parcours complet ouvrir un plan →
accepter → mesurer → trancher.
