# Moteur de données SUITON OS

Chaque chantier terminé et facturé rend le suivant mieux estimé.

---

## Le problème, d'abord

Vous avez zéro chantier réalisé. Il n'existe donc **aucune moyenne**.

Avec trois chantiers, il existe une moyenne — qui ne vaut rien : un chantier
atypique la déplace de 40 %. Un système qui afficherait « temps moyen : 4 h 12 »
sur trois observations mentirait par omission, et le danger d'un chiffre
présenté comme statistique est qu'on finit par lui faire confiance. On
tarifierait sur du bruit.

Tout ce moteur est construit autour de trois règles :

1. **Tout indicateur porte un niveau de confiance explicite.** Un chiffre
   sans son assise n'est pas affiché seul.
2. **Sous 5 chantiers comparables, on renvoie la valeur de catalogue**, et on
   le dit. Pas une moyenne déguisée.
3. **On utilise la médiane, pas la moyenne.** Un chantier catastrophique ne
   doit pas déplacer la référence de tous les autres. _Vérifié : un chantier à
   10 min/m² au milieu de cinq chantiers à 2,4 déplace la référence de moins
   de 1 %._

| Observations | Confiance | Ce qui est utilisé |
| ------------ | --------- | ------------------ |
| 0–2          | aucune    | Catalogue          |
| 3–4          | faible    | Catalogue          |
| 5–9          | moyenne   | Médiane observée   |
| 10–24        | bonne     | Médiane observée   |
| 25+          | élevée    | Médiane observée   |

---

## Ce qui est enregistré

Une ligne `job_metrics` par chantier, recalculée intégralement à chaque étape
du cycle. Idempotente — pas de compteur incrémental, donc pas de dérive.

**Commercial** · devis HTVA/TTC, facturé, écart de facturation, délai de
signature, délai de paiement
**Opérationnel** · surface, service, salissure, techniciens, durée estimée,
durée réelle, **minutes par m²**, temps par étape, matériel
**Qualité** · photos, paires complètes/incomplètes, couverture, checklist
complète, **checklist suspecte**, retouches, incidents
**Client** · note d'avis, avis déposé, rang du chantier chez ce client

### Le champ qui compte : `checklist_suspecte`

Six étapes cochées à la même minute signalent une checklist remplie après coup.
Ces chantiers sont **exclus des références** : leurs durées ne mesurent rien.
Les inclure polluerait la base de référence de façon invisible et permanente.

### Les bandes de surface

Comparer un studio de 40 m² à une villa de 400 m² n'a pas de sens : la cadence
au m² n'est pas linéaire, les petites surfaces portant un coût fixe
d'installation proportionnellement plus lourd. Cinq bandes : `xs` `s` `m` `l` `xl`.

---

## Intelligence des devis

`estimerAvecHistorique()` — module pur, testable, sans dépendance serveur.

Pour _maison 150 m², rénovation, 2 techniciens_, le système donne :

- **durée** issue de la référence effective (observée ou catalogue) ;
- **fourchette de prix** — uniquement à partir de 5 chantiers comparables ;
- **CA horaire attendu**, même condition ;
- **niveau de confiance** et la phrase qui l'explique ;
- **alertes** déduites.

### Le rendement d'équipe n'est pas linéaire

Deux techniciens vont plus vite, mais pas deux fois plus : on se croise, on se
parle, on se repasse le matériel. Le modèle applique 15 % de perte par
technicien supplémentaire, et alerte au-delà de deux personnes sur moins de
150 m² — au-delà, on se gêne plus qu'on ne s'aide.

### Les alertes qui font gagner de l'argent

> « Sur ce gabarit, vous facturez en moyenne 23 % au-dessus de la grille. La
> grille est peut-être sous-évaluée. »

C'est le genre de constat qu'on ne fait jamais soi-même, parce qu'on ne
compare pas trente devis de tête.

---

## Base de connaissances

Cinq questions, cinq réponses **avec leur assise** :

| Question                                      | Refus quand                      |
| --------------------------------------------- | -------------------------------- |
| Combien de temps pour un chantier similaire ? | jamais — repli catalogue         |
| Quelle marge horaire ?                        | aucun chantier facturé           |
| Quelle équipe est la plus efficace ?          | moins de 2 équipes à 5 chantiers |
| Quelle commune est la plus rentable ?         | aucune commune à 3 chantiers     |
| Quel service fidélise le plus ?               | moins de 5 chantiers terminés    |

Comparer deux équipes sur trois chantiers chacune mesure le hasard des
chantiers attribués, pas l'efficacité. Le système le dit plutôt que de
répondre.

---

## Tableau de bord — `/donnees`

Huit indicateurs : cadence médiane, CA horaire, précision d'estimation,
couverture photo, taux de retouche, écart de facturation, note moyenne,
chantiers complets. Chacun avec sa pastille de confiance, et un tiret — pas un
zéro — quand la donnée manque. « 0 min/m² » se lit comme une mesure, « — » se
lit comme une absence.

Le graphique **« Où part le temps »** superpose médiane et p90 par étape : la
médiane dit le cas courant, le p90 dit ce qui dérape.

---

## Vues SQL

| Vue                     | Répond à                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `reference_observee`    | médiane et quartiles par gabarit                                                        |
| `reference_effective()` | **la fonction pivot** : observée si solide, catalogue sinon, toujours avec la confiance |
| `stats_par_service`     | rendement et rentabilité par type                                                       |
| `stats_par_commune`     | où prospecter                                                                           |
| `stats_par_equipe`      | efficacité, y compris checklists suspectes                                              |
| `stats_estimation`      | la grille est-elle juste ?                                                              |
| `stats_par_etape`       | où part le temps                                                                        |

Toutes en `security_invoker` : elles appliquent la RLS de l'appelant, elles ne
la contournent pas.

---

## Ce qui n'est pas fait

**Le SEO automatique et le rapport qualité enrichi de graphiques** n'ont pas
été livrés dans ce sprint. Le socle est là — `job_metrics` porte tout ce qu'il
faut, et `comparerALaReference()` produit déjà le verdict — mais l'intégration
au PDF et la génération de contenu SEO restent à faire.

C'est un choix : mieux vaut un moteur de données honnête et vérifié qu'un
moteur à moitié fiable doublé de deux fonctionnalités de surface.

---

## Vérification

```bash
npm run verify    # types + lint + 138 tests + build
npm run test:db   # 57 assertions contre PostgreSQL
```

Les assertions couvrent explicitement le refus de mentir : référence
catalogue à 0 et 3 chantiers, bascule sur l'observé à 5, et résistance de la
médiane à un chantier aberrant.
