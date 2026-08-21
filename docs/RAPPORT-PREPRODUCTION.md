# Rapport de préproduction

**Date :** 19 août 2026 · **État :** ✅ **PRÊT POUR VALIDATION HUMAINE**

**suiton.be n'a pas été mis en ligne. Aucune action de production n'a été
effectuée.**

---

## Ce qui a été fait, et ce qui ne pouvait pas l'être

Deux choses relèvent d'un accès que je n'ai pas : le déploiement Vercel et le
DNS. Elles ne sont donc pas faites — et elles ne l'auraient pas été de toute
façon, puisque vous n'avez pas donné votre accord.

**Il n'existe pas d'URL de preview à vous donner aujourd'hui.** Je n'ai pas
d'identifiants Vercel dans cet environnement. Ce que j'ai livré à la place est
tout ce qu'il faut pour qu'elle existe en une commande : la configuration, les
variables, les garde-fous et la procédure (`docs/PREVIEW.md`). Vous lancez
`vercel` — sans `--prod` — et l'URL apparaît.

C'est la seule zone d'ombre de ce rapport, et je préfère la nommer d'emblée
plutôt que la laisser se découvrir au § 5.

---

## Architecture

Le projet n'a pas été refait. Le moteur de prix, la réservation, le portail,
le CRM, le système documentaire, le SEO et la sécurité sont ceux qui
existaient. Ce qui a changé est la **structure autour** : trois environnements
étanches, et une porte fermée devant la production.

```
Claude Code
    ↓
Développement          APP_ENV=development · localhost:3000
    ↓                  noindex · courriels capturés · données DÉMO
Tests automatisés      npm run go-live — 536 contrôles
    ↓
Preview                APP_ENV=preview · *.vercel.app
    ↓                  noindex · courriels capturés · base de staging
Validation humaine     ← VOUS ÊTES ICI
    ↓
« GO PRODUCTION SUITON »
    ↓
Production             APP_ENV=production · https://suiton.be
```

### La distinction qui rend tout le reste possible

`APP_ENV` n'est pas `NODE_ENV`. NODE_ENV dit comment le code est **compilé** ;
APP_ENV dit à quoi il est **branché**. Une preview Vercel tourne en
`NODE_ENV=production` tout en devant rester non indexable et n'envoyer aucun
courriel. Sans cette distinction, on ne peut pas exprimer « build de
production, environnement de test » — et c'est exactement la situation d'une
preview.

| `APP_ENV`     | Indexable | Courriels   | Données | Bandeau | `/dev/emails` |
| ------------- | --------- | ----------- | ------- | ------- | ------------- |
| `development` | non       | capturés    | DÉMO    | visible | accessible    |
| `preview`     | non       | capturés    | DÉMO    | visible | accessible    |
| `production`  | **oui**   | **envoyés** | réelles | absent  | **404**       |

---

## Tests — 536 contrôles, 0 rouge

```bash
npm run go-live
```

| Étape                                          | Contrôles | Résultat                      |
| ---------------------------------------------- | --------: | ----------------------------- |
| `typecheck` — TypeScript strict                |         — | ✅ 0 erreur                   |
| `lint`                                         |         — | ✅ 0 erreur, 0 avertissement  |
| `test` — unitaires                             |       249 | ✅ 249 / 249                  |
| `build`                                        |         — | ✅ compilé                    |
| `audit` — SEO, a11y, budgets, maillage         |        24 | ✅ 23 pages, 0 problème       |
| `prod:db` — migrations sur PostgreSQL réel     |        24 | ✅ 35 tables, toutes avec RLS |
| `prod:schema` — schéma et RLS                  |       117 | ✅ 117 / 117                  |
| `prod:coef` — bornes des coefficients          |         5 | ✅ 5 / 5                      |
| `prod:seed` — marquage et idempotence          |        21 | ✅ 21 / 21                    |
| `prod:e2e` — bout en bout HTTP                 |        78 | ✅ 78 / 78                    |
| `prod:securite`                                |        66 | ✅ 66 / 66                    |
| `prod:env-sep` — séparation des environnements |        27 | ✅ 27 / 27                    |
| **Total**                                      |   **536** | **✅ 536 / 536**              |

> **Un test vert ne remplace pas votre validation.** Le rendu sur téléphone
> n'est vérifié par aucun automatisme : il n'y a pas de navigateur dans cet
> environnement. C'est le seul contrôle de la liste qui ne s'automatise pas,
> et c'est celui qui compte le plus.

### Les 27 contrôles de séparation des environnements

Ils ne vérifient pas une intention mais un comportement : l'application est
**réellement construite** dans chaque configuration, et on lit ce qu'elle
produit.

```
A. Développement       robots.txt Disallow: / · noindex · bandeau · canonique locale
B. Preview             robots.txt Disallow: / · noindex · bandeau orange · X-Robots-Tag
C. Production          Allow: / · index, follow · aucun bandeau · canonique suiton.be
                       · /portail/ toujours interdit
D. Garde-fous          « oui » annule · « GO PRODUCTION » annule · phrase exacte confirme
                       · le garde-fou n'importe aucun lanceur de processus
                       · le seed refuse APP_ENV=production
E. Secrets             .env.example sans aucune valeur · .env.* et .emails/ ignorés par Git
```

---

## Base de données

24 migrations, 35 tables, **toutes avec RLS activée**. 31 fonctions métier,
20 vues en `security_invoker`, 24 déclencheurs, 130 index.

Les 25 fonctions `SECURITY DEFINER` fixent toutes leur `search_path`.

Un contrôle a été **corrigé** parce qu'il passait pour de mauvaises raisons :
`set local role` n'a d'effet que dans une transaction, et l'audit s'exécutait
donc en superutilisateur, qui contourne la RLS. Sur des tables vides, le
compte tombait à zéro et le test passait. Corrigé, il annonce maintenant ce
qu'il y a réellement à cacher :

```
ok  counters illisible par « authenticated » — 2 ligne(s) en base, 0 visible(s)
ok  rate_limits illisible par « authenticated » — 6 ligne(s) en base, 0 visible(s)
```

---

## Données de démonstration

```bash
npm run db:seed
```

Un parcours complet, du lead à la réalisation publiée :

| Étape           | Chantier                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------- |
| Demande fraîche | Maison 140 m², Enghien                                                                          |
| Devis envoyé    | Appartement 95 m², Nivelles, urgent                                                             |
| Planifié        | Villa 260 m², Waterloo                                                                          |
| **Livré**       | Appartement 88 m², Hal — devis accepté, checklist, rapport, facture Peppol, réalisation publiée |
| Perdu           | Studio, Tubize                                                                                  |

**Trois marqueurs, redondants à dessein :**

- tout nom commence par `DÉMO — `
- toute adresse est en `@demo.suiton.invalid` — TLD réservé par la RFC 2606,
  **il ne se résout jamais** : même un envoi accidentel n'atteindrait personne
- tout numéro est en `0400 00 00 xx`, plage non attribuée en Belgique

Un seul suffirait à distinguer les données. Les trois ensemble rendent
l'erreur invisible impossible, y compris à l'œil nu dans une liste.

Le seed **refuse de s'exécuter** si `APP_ENV=production`, ou si la base n'est
ni locale ni explicitement autorisée. Il est idempotent, et `reset-demo`
supprime tout — dans l'ordre imposé par les contraintes `RESTRICT`, factures
d'abord : une pièce comptable ne disparaît pas parce qu'on efface un chantier.

Une remarque au passage : écrire ce seed a **confirmé que les règles métier
tiennent**. La base a refusé un client professionnel sans TVA, un rapport sans
checklist complète, et une facture B2B sans identifiant Peppol. J'ai dû
corriger le seed, pas les contraintes. C'est le bon sens de la relation.

---

## Sécurité — 66 contrôles

En-têtes CSP, HSTS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy:
no-referrer`, COOP. Hors production, `X-Robots-Tag: noindex` s'ajoute — et il
couvre **tout ce qui sort du serveur**, y compris le sitemap, les PDF et les
réponses d'API, que la balise meta ne couvre pas.

- `anon` et `authenticated` ne lisent **rien** — 28 combinaisons rôle × table
- jetons de portail : 32 octets aléatoires, SHA-256 + poivre, jamais en clair
- aucun secret serveur dans les 63 fichiers envoyés au navigateur
- limitation de débit sur les 4 routes publiques
- **EXIF/GPS réellement supprimés** — vérifié sur une image porteuse de GPS,
  pas par lecture de code
- un fichier renommé en `.jpg` est rejeté par le traitement

---

## SEO

Vérifié sur un build en configuration de production : 23 pages, titres et
descriptions uniques et calibrés, un seul H1 par page, canoniques,
JSON-LD `LocalBusiness` / `Service` / `FAQPage` / `BreadcrumbList` / `Article`,
sitemap complet, 0 lien cassé, 0 page orpheline. Pages locales : 43 % à 49 %
de contenu propre.

`npm run audit` **refuse de conclure** sur un build hors production. Sur un
build de développement il signalerait vingt-six « problèmes » qui sont le
comportement attendu — et on prendrait l'habitude de l'ignorer. Un audit qu'on
ignore ne sert à rien.

---

## Mobile

**Non vérifié — et c'est le point le plus important de ce rapport.**

L'audit contrôle la structure : cibles tactiles à 44 px, un seul H1,
étiquettes de formulaire, `prefers-reduced-motion`, contrastes choisis à la
conception. Il ne contrôle pas le **rendu**, faute de navigateur.

`docs/PREVIEW.md` § 4 liste ce qu'il faut regarder, écran par écran. Comptez
dix minutes sur un vrai téléphone, en portrait **et** en paysage. Le paysage
est celui qu'on oublie.

---

## Courriels

`EMAIL_MODE=preview` : **rien ne part**. Chaque message est écrit dans
`.emails/` et consultable sur **`/dev/emails`** — HTML rendu tel que le verra
le client, version texte, pièces jointes.

La propriété a été vérifiée dans le cas qui compte : **même avec une vraie
`RESEND_API_KEY` dans l'environnement, aucun courriel ne part.** Le contrôle
du mode vient **avant** la lecture de la clé, délibérément.

Le défaut de `EMAIL_MODE` est `preview`. Ce choix est asymétrique : un oubli
de configuration doit produire un courriel non envoyé, jamais un courriel
parti chez un vrai client. On rattrape le premier ; pas le second.

`/dev` renvoie un 404 en production, avant même de rendre la page.

---

## Production

**Aucune action effectuée. Aucune n'était possible sans votre accord.**

Quatre commandes existent, et aucune n'exécute quoi que ce soit :

```bash
npm run prod:deploy    # déploiement
npm run prod:migrate   # migrations
npm run prod:dns       # DNS
npm run prod:env       # variables
```

Chacune affiche l'action, l'environnement, l'impact, la procédure de retour
arrière, puis exige la phrase **`GO PRODUCTION SUITON`** tapée exactement.
Toute autre réponse annule.

Un contrôle vérifie que le garde-fou **n'importe aucun lanceur de processus** :
il ne _peut_ pas déployer, quoi qu'on lui réponde. Une règle dans un document
se contourne par distraction, à 23 h, un vendredi. Une commande qui n'en a pas
les moyens, non.

---

## Ce qu'il vous reste à faire

### 1. Localement — dix minutes

```bash
npm install
cp .env.example .env.local
npm run demo
```

Parcourez `/`, le calculateur, `/reservation` jusqu'au bout, le portail avec
le lien obtenu, puis `/dev/emails` pour relire les messages.

### 2. Déployer une preview

```bash
npm run go-live      # 536 contrôles
vercel               # SANS --prod
```

Renseignez les variables de preview (`docs/PREVIEW.md` § 2). Trois points sur
lesquels ne pas transiger : un **projet Supabase de staging distinct**, un
**`PORTAL_TOKEN_PEPPER` différent** de la production, et `EMAIL_MODE=preview`.

### 3. Valider sur un vrai téléphone

`docs/PREVIEW.md` § 4.

### 4. Me dire

**validé**, **à corriger**, ou **bloquant**. Une remarque du type « le bouton
est trop bas sur mon téléphone » suffit — je m'occupe de la traduction
technique.

---

## Condition de fin

| Condition                                 | État                                          |
| ----------------------------------------- | --------------------------------------------- |
| Le projet fonctionne localement           | ✅                                            |
| La démo fonctionne                        | ✅ `npm run demo`                             |
| Les données de démonstration fonctionnent | ✅ 21 contrôles                               |
| Le preview fonctionne                     | ⚠️ configuré et vérifié ; à déployer par vous |
| Les tests passent                         | ✅ 536 / 536                                  |
| Le SEO fonctionne                         | ✅ 23 pages                                   |
| La réservation fonctionne                 | ✅ vérifiée en HTTP réel                      |
| Le portail fonctionne                     | ✅ jeton valide 200, jeton altéré 404         |
| Les documents fonctionnent                | ✅ devis, rapport, facture Peppol             |
| Les courriels sont visualisables          | ✅ `/dev/emails`                              |
| Aucune donnée réelle dans la démo         | ✅ trois marqueurs vérifiés                   |
| **Aucune modification de production**     | ✅ **aucune**                                 |

---

# PRÊT POUR VALIDATION HUMAINE

**suiton.be n'est pas en ligne.**

J'attends **`GO PRODUCTION SUITON`**.
