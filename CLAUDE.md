# SUITON OS — consignes de travail

Ce fichier est lu automatiquement au démarrage d'une session. Il dit ce qu'il
faut savoir avant de toucher au code, et ce qu'il ne faut pas faire.

## La règle qui prime sur toutes les autres

**Rien ne part en production sans le message explicite `GO PRODUCTION SUITON`
de Sacha Mercier.**

Sont interdits sans cet accord :

- `vercel --prod` et toute promotion d'un déploiement en production
- toute modification du DNS de `suiton.be`
- `supabase db push` sur le projet de production
- toute modification des variables d'environnement de production
- l'usage des identifiants de production pendant le développement

Ces actions passent par `npm run prod:deploy`, `prod:migrate`, `prod:dns`,
`prod:env`. Ces commandes n'exécutent rien : elles affichent l'action,
l'impact, la procédure de retour arrière, et exigent la phrase de
confirmation. Ne pas les contourner.

## Trois environnements

| APP_ENV       | Où             | Indexable | Courriels   | Données       |
| ------------- | -------------- | --------- | ----------- | ------------- |
| `development` | localhost:3000 | non       | capturés    | démonstration |
| `preview`     | `*.vercel.app` | non       | capturés    | démonstration |
| `production`  | suiton.be      | **oui**   | **envoyés** | réelles       |

`APP_ENV` n'est pas `NODE_ENV`. NODE_ENV dit comment le code est compilé ;
APP_ENV dit à quoi il est branché. Une preview Vercel tourne en
`NODE_ENV=production` tout en devant rester non indexable.

## Démarrer

```bash
npm install
cp .env.example .env.local     # les valeurs de développement suffisent
npm run db:seed                # données de démonstration
npm run dev
```

Voir `docs/DEVELOPPEMENT.md` pour le détail.

## Avant de proposer un changement

```bash
npm run go-live
```

536 contrôles : typecheck, lint, tests, build, audit du site, migrations sur
un PostgreSQL réel, schéma et RLS, coefficients, seed, bout en bout HTTP,
sécurité. Aucun changement n'est proposé sans que la chaîne soit verte.

**Un test vert ne remplace pas la validation visuelle de Sacha.** Le rendu sur
téléphone, en particulier, n'est vérifié par aucun automatisme.

## Ce qui ne se refait pas

Le projet est mûr. Ne pas reconstruire : le moteur de prix, la réservation, le
portail, le CRM, le système documentaire, le SEO, les pages locales, la
sécurité. Améliorer l'existant.

## Décisions structurantes à respecter

- **La grille tarifaire vit en base**, dans `settings`. Jamais en dur dans le
  code. Le logiciel propose, le dirigeant valide. Aucun ajustement
  automatique.
- **`estimate()` est la source unique du prix.** Le calculateur public, le
  devis et le tableau de bord l'appellent tous. Ne jamais créer un second
  chemin de calcul.
- **Le montant n'est jamais accepté en entrée d'API.** Il est recalculé côté
  serveur, systématiquement.
- **Le client admin (`createAdminClient`) contourne la RLS.** Son usage est
  restreint par ESLint à une liste revue une par une. Toute addition à cette
  liste est une décision d'architecture, pas un contournement.
- **Les jetons de portail ne sont jamais stockés en clair** : SHA-256 + poivre.
- **Identité visuelle figée** : Abysse `#0B2239`, Océan `#14415F`, Aqua
  `#5FC2CE`, Minéral `#F4F6F5`, Jura et Inter. Aucun dégradé. L'aqua est
  réservé aux éléments de preuve.
- **Aucune donnée inventée sur le site public.** Pas de faux avis, pas de faux
  chantiers, pas de photos de banque d'images. Sur un métier qui vend la
  preuve, c'est la contradiction la plus coûteuse possible.

## Langue

Code, commentaires, messages de commit et interface : **en français**.
Les commentaires expliquent _pourquoi_, pas _quoi_.
