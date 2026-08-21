# suiton.be — version de lancement

**Date :** 19 août 2026 · **Ouverture prévue :** 1ᵉʳ octobre 2026
**Verdict :** ✅ **prêt à déployer** — 515 contrôles automatisés, 0 rouge

Ce document complète `MISE-EN-LIGNE-SUITON-BE.md`, qui reste la référence
pour l'audit, les métriques et les procédures de déploiement, de rollback et
d'indexation. Ici : ce qui a changé pour le lancement commercial, et pourquoi.

---

## 1. Ce qui existait déjà, et qui n'a pas été refait

L'essentiel de la demande était livré et vérifié. Le rappeler évite de
reconstruire ce qui fonctionne :

| Demande                                                              | État                                        |
| -------------------------------------------------------------------- | ------------------------------------------- |
| 5 pages de service optimisées SEO                                    | ✅ livrées                                  |
| 8 pages locales, contenu réellement unique                           | ✅ 43 % à 49 % de contenu propre            |
| Parcours de réservation complet                                      | ✅ 6 étapes, validé de bout en bout en HTTP |
| Création automatique du chantier                                     | ✅ `create_booking()`, une transaction      |
| Portail client : devis, suivi, photos, documents                     | ✅ testé avec un vrai jeton                 |
| SEO complet : titles, meta, JSON-LD, sitemap, robots, canonicals, OG | ✅ 0 doublon, 0 lien cassé                  |
| Barre Appeler / WhatsApp / Réserver permanente sur mobile            | ✅                                          |
| Identité Abysse, Aqua, Minéral, Jura, Inter                          | ✅ inchangée                                |
| Supabase, Resend, Google Calendar                                    | ✅ code en place                            |
| Préparation Vercel, SSL, DNS, indexation                             | ✅ documentée                               |

## 2. Les six manques réels, comblés

### 2.1 WhatsApp dans le premier écran

Le hero n'offrait que deux chemins : devis et téléphone. WhatsApp y figure
désormais, avec un message pré-rempli.

Un fil qui s'ouvre vide fait porter au visiteur la charge de formuler sa
demande. Une première phrase déjà écrite lève cette friction, et nous
arrivons avec un début de qualification plutôt qu'un « bonjour ».

Trois chemins, parce que trois publics : un chef de chantier appelle, un
entrepreneur en réunion écrit sur WhatsApp, un particulier remplit un
formulaire le soir. N'en proposer qu'un, c'est perdre les deux autres.

### 2.2 Calculateur — type de bien et clarté sur les vitres

Le calculateur ignorait le type de bien. Or un studio de 80 m² et une villa
de 80 m² ne demandent pas le même travail : nombre de sanitaires, escaliers,
surface vitrée.

**La règle fondatrice est respectée : le système ne modifie jamais la grille
tarifaire de lui-même.** Les sept coefficients sont créés à **1,000**, donc
sans le moindre effet sur les prix actuels. Ils apparaissent dans l'écran des
réglages ; le dirigeant les ajustera quand ses chantiers réels le
justifieront — ou jamais.

Trois garde-fous, tous testés :

- bornes 0,5 – 2,0 en base **et** dans le schéma Zod : une faute de frappe ne
  peut pas multiplier un devis par dix ;
- une grille à laquelle il manque un type de bien est rejetée ;
- un test unitaire vérifie qu'à 1,000 le prix est **identique** au calcul
  d'avant. C'est toute la garantie de la migration.

Le calculateur affiche maintenant explicitement que **vitres, châssis et
seuils sont compris**. C'est la promesse de marque : elle doit apparaître à
l'endroit exact où le visiteur regarde un prix, pas trois écrans plus bas.

### 2.3 Réalisations — la galerie réelle

C'est le point où j'ai refusé la solution facile.

SUITON ouvre le 1ᵉʳ octobre. Il n'y a **aucun chantier réel à montrer**. Sur
un site dont la proposition entière est « nous prouvons le résultat »,
publier des cas clients inventés ou des photos de banque d'images serait la
contradiction la plus coûteuse possible — et elle se repère en trois
secondes.

Ce qui a été construit à la place est le **système**, alimenté par les vraies
données :

- `/realisations` liste les chantiers publiés depuis `jobs`
- `/realisations/[slug]` : fiche complète, comparaison avant/après au curseur,
  JSON-LD `Article`, entrée automatique au sitemap
- un panneau **Publier** dans l'espace de gestion, sur chaque chantier terminé

Trois garde-fous à la publication :

1. **seul un chantier terminé** peut être publié — publier un chantier en
   cours reviendrait à montrer un résultat qu'on n'a pas obtenu ;
2. **le consentement photo est revérifié au moment de publier**, pas au
   moment de la demande : un client peut l'avoir retiré entre-temps. Sans
   consentement, la fiche sort **sans image** — le texte reste utile au
   référencement, la vie privée reste intacte ;
3. **le résumé doit faire 80 caractères minimum**, écrit à la main. La base
   l'impose déjà (`jobs_publie_a_un_resume`).

Ce dernier point est le seul travail manuel de toute la chaîne, et il est
délibéré : un texte généré à partir d'un gabarit produirait vingt pages qui
se ressemblent, et Google ne positionne pas des pages qui se ressemblent.
Trois phrases écrites par celui qui était sur place valent mieux que trois
paragraphes automatiques.

`revalidatePath` est appelé à la publication : la fiche est en ligne
immédiatement, pas dans une heure.

**Ces pages seront à terme les plus rentables du site.** Aucune page de
service ne peut couvrir « nettoyage après rénovation appartement 90 m²
Waterloo ». Une fiche de chantier, si.

### 2.4 Contact — formulaire de rappel et carte de zone

Un formulaire de rappel à **trois champs** : nom, numéro, message facultatif.

Il ne fait pas doublon avec la réservation : il s'adresse à l'autre visiteur,
celui qui veut qu'on l'appelle sans remplir six étapes. Lui demander sa
surface et son code postal le ferait partir. Le numéro est le seul champ
vraiment nécessaire — c'est ce qu'on promet d'utiliser.

Route API réelle : validation Zod, limitation à 5 par heure et par IP, champ
piège. La réponse est **volontairement identique que le courriel parte ou
non** : si Resend tombe, le visiteur voit une confirmation, le message est
journalisé côté serveur, et nous rappelons quand même. Lui afficher une
erreur technique le ferait partir sans nous laisser son numéro.

**La carte est dessinée en SVG** à partir des coordonnées réelles des huit
communes, projetées en Mercator. Pas d'iframe Google Maps : elle chargerait
un script tiers, déposerait des cookies, imposerait une bannière de
consentement, ouvrirait la CSP et pèserait plusieurs centaines de kilo-octets.
Le visiteur pose une seule question — « venez-vous chez moi ? » — et un plan
schématique y répond mieux qu'une carte routière, pour deux kilo-octets. Un
lien vers Google Maps reste disponible pour l'itinéraire.

### 2.5 Portail client — réserver à nouveau

Un client déjà livré est le lead le moins cher qui existe : il connaît le
prix, il a vu le rapport, il n'a plus à être convaincu. Le portail restant
valable douze mois, c'est aussi là qu'il revient naturellement.

Le lien pré-remplit le service, le type de bien et la commune du chantier
précédent. **Il ne pré-remplit pas la surface** : un second chantier a
rarement la même, et un champ pré-rempli faux est pire qu'un champ vide.

Le bloc n'apparaît qu'au stade « terminé ». Le proposer pendant que le
premier chantier est en cours donnerait l'impression qu'on cherche à vendre
avant d'avoir fini — exactement ce dont un client se souvient.

### 2.6 Publication depuis l'espace de gestion

Sans elle, la galerie serait restée théorique. Sacha peut désormais publier
un chantier en deux minutes, depuis la fiche du chantier.

---

## 3. Vérification

```bash
npm run go-live
```

| Étape                                  |     Contrôles | Résultat                      |
| -------------------------------------- | ------------: | ----------------------------- |
| `typecheck`                            |             — | ✅ 0 erreur                   |
| `lint`                                 |             — | ✅ 0 erreur, 0 avertissement  |
| `test`                                 |           249 | ✅ 249 / 249                  |
| `build`                                |             — | ✅ compilé                    |
| `audit` (SEO, a11y, budgets, maillage) |      23 pages | ✅ 0 problème                 |
| `prod:db`                              | 24 migrations | ✅ 35 tables, toutes avec RLS |
| `prod:schema`                          |           117 | ✅ 117 / 117                  |
| `prod:coef`                            |             5 | ✅ 5 / 5                      |
| `prod:e2e`                             |            78 | ✅ 78 / 78                    |
| `prod:securite`                        |            66 | ✅ 66 / 66                    |
| **Total**                              |       **515** | **✅ 515 / 515**              |

### Nouveaux contrôles de bout en bout

```
11. Demande de rappel
  ok  rappel sans nom ni numero -> 422
  ok  rappel avec champ piege rempli -> 422
  ok  numero invalide -> 422
  ok  rappel valide -> 201
  ok  le formulaire de rappel est limite en debit — refus a la tentative n° 6

12. Realisations
  ok  galerie vide : elle annonce l'ouverture au lieu d'inventer des references
  ok  fiche inconnue -> 404
  ok  la fiche du chantier publie repond 200
  ok  la fiche affiche la surface et la commune reelles
  ok  la fiche porte un JSON-LD Article
  ok  la fiche renvoie vers un devis pre-rempli
  ok  publication sans resume redige refusee par la base

13. Calculateur — type de bien
  ok  le calculateur demande le type de bien
  ok  la page affirme que les vitres sont comprises
  ok  les coefficients restent neutres tant que le dirigeant ne les touche pas
  ok  un pre-remplissage invalide est ignore, pas fatal
```

### Une faille corrigée dans l'audit lui-même

Le contrôle « `counters` et `rate_limits` illisibles par _authenticated_ »
passait pour de mauvaises raisons : `set local role` n'a d'effet que dans une
transaction, et l'audit s'exécutait donc en superutilisateur, qui contourne
la RLS. Les tables étant vides, le compte tombait à zéro et le test passait.

Corrigé : chaque contrôle s'exécute maintenant dans une transaction, et
affiche le nombre de lignes réellement présentes. La preuve devient lisible :

```
ok  counters illisible par « authenticated » — 2 ligne(s) en base, 0 visible(s)
ok  rate_limits illisible par « authenticated » — 6 ligne(s) en base, 0 visible(s)
```

Un test vert qui ne teste rien est plus dangereux qu'un test absent : il
achète une confiance qu'il ne mérite pas.

---

## 4. Métriques réelles

TTFB de rendu, 15 requêtes par page après chauffe :

| Page                      |    Médiane |     p95 |
| ------------------------- | ---------: | ------: |
| Accueil                   | **2,7 ms** |  4,2 ms |
| Nettoyage fin de chantier |     2,0 ms |  4,2 ms |
| Page locale               |     1,8 ms |  2,2 ms |
| Devis                     |     1,5 ms |  3,3 ms |
| Réservation (dynamique)   |     6,3 ms | 11,1 ms |

Poids de l'accueil, première visite :

| Ressource           |        Brut |         gzip |      brotli |
| ------------------- | ----------: | -----------: | ----------: |
| HTML                |    135,8 ko |      22,8 ko | **14,6 ko** |
| CSS bloquant        |     40,6 ko |   **8,1 ko** |           — |
| JS (12 fichiers)    |    514,8 ko |     160,6 ko |           — |
| Polices woff2 (5)   | **98,4 ko** |            — |           — |
| **Chemin critique** |    274,8 ko | **129,3 ko** |           — |

Charge : **855 req/s** sur l'accueil statique, **256 req/s** sur la
réservation dynamique, 0 erreur.

**Lighthouse, LCP, CLS et INP ne sont toujours pas mesurés** — ils exigent un
navigateur réel sur un site en ligne, et il n'y en a pas dans cet
environnement. La procédure est au § 7 de `MISE-EN-LIGNE-SUITON-BE.md`. Une
fois le domaine actif, Vercel Speed Insights remontera les valeurs réelles de
vos visiteurs, plus fiables que n'importe quelle simulation.

---

## 5. Publier un chantier — mode d'emploi

Deux minutes, à faire dès le premier chantier livré.

1. Espace de gestion → **Chantiers** → le chantier concerné
2. Le passer à l'étape **terminé** s'il ne l'est pas
3. Panneau **Réalisation**, en bas de la colonne de droite
4. Écrire le résumé — 80 caractères minimum. Trois phrases suffisent :
   > _« Maison de 140 m² à Enghien, livrée après plafonnage. Poussière de
   > ponçage dans toutes les rainures de châssis, film plastique encore collé
   > sur six vitrages. Sept heures d'intervention, vitres comprises. »_
5. **Publier sur le site** — la fiche est en ligne immédiatement

**Ce qu'il faut écrire :** ce qui était sur place. L'état du chantier, ce qui
résistait, ce que ça a demandé. Pas ce que vous vendez : la page de service
s'en charge déjà.

**Ce qui se passe si le client n'a pas donné son accord photo :** la fiche
est publiée sans image. Le texte travaille quand même pour le référencement.

**Objectif raisonnable :** une réalisation publiée par semaine les trois
premiers mois. Douze fiches, douze combinaisons commune × surface × service
que vos concurrents ne couvrent pas.

---

## 6. Les cinq actions qui restent, et qu'aucun code ne peut faire

Inchangées depuis l'audit de mise en ligne :

1. Créer le projet Supabase (région UE) et pousser les migrations
2. Déployer sur Vercel, régler le DNS de suiton.be
3. **Vérifier le domaine chez Resend** — SPF, DKIM, DMARC. Sans cela, chaque
   accusé de réception part en spam, et un client qui ne reçoit rien croit
   que sa demande s'est perdue. C'est le point le plus souvent négligé.
4. Créer la fiche Google Business Profile (vérification par courrier postal)
5. Relever Lighthouse / LCP / CLS / INP, et **parcourir le site sur un vrai
   téléphone**. Dix minutes. C'est le seul contrôle de cette liste qui ne
   s'automatise pas.

---

## 7. Les dix premiers leads

Le site est prêt. Ce qui déterminera les dix premiers leads n'est plus lui :

| Ce qui compte                         | Pourquoi                                                                                                                                             |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Google Business Profile**           | Sur « nettoyage fin de chantier Enghien », la fiche locale apparaît avant les résultats naturels. C'est le canal le plus rapide sur un domaine neuf. |
| **Les 9 URL soumises à l'indexation** | Un domaine neuf n'est pas exploré spontanément avant plusieurs semaines.                                                                             |
| **Le premier chantier publié**        | Il transforme la galerie en preuve, et ouvre une page de longue traîne.                                                                              |
| **Les avis**                          | Sollicitez **tout le monde**, à l'identique. Filtrer est interdit par Google et fait supprimer les avis obtenus.                                     |

Le référencement naturel des pages locales mettra deux à quatre mois à
produire. D'ici là, les leads viendront de la fiche Google, du bouche-à-
oreille et de vos contacts entrepreneurs — et le site est ce qui les
convertira, pas ce qui les amènera.

**Le seul indicateur à suivre les trente premiers jours :** combien de
demandes, et combien deviennent des chantiers. Le score Lighthouse, la
position dans les résultats et le nombre de pages indexées ne sont que des
moyens d'y arriver.
