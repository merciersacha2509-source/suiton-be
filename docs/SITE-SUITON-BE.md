# suiton.be — site public

Ce document décrit ce qui a été construit, pourquoi, et comment le mettre en
ligne. Il complète `docs/MISE-EN-PRODUCTION.md`, qui couvre l'application de
gestion.

---

## 1. La décision d'architecture

**Le site public vit dans le dépôt SUITON OS, pas à côté.**

Avant d'écrire une ligne, trois choses existaient déjà : le parcours de
réservation en six étapes (`/reservation`), le portail client
(`/portail/[token]`), et le moteur de prix (`src/lib/pricing.ts`). Construire
suiton.be comme un projet séparé aurait signifié les redévelopper.

Le coût réel de cette duplication n'est pas le temps de développement : c'est
qu'il aurait existé **deux moteurs de prix**. Le jour où la grille tarifaire
change dans `settings`, le site marketing continue d'afficher l'ancienne. Un
visiteur voit 1 200 € sur le calculateur et reçoit un devis à 1 600 €. Ce n'est
pas un bug qu'on remarque : c'est un lead perdu sans explication.

Le site est donc un groupe de routes `src/app/(site)/`, servi par le même
déploiement, lisant la même ligne `settings`, appelant la même fonction
`estimate()`.

```
src/app/
├── (site)/          ← suiton.be : public, indexé
│   ├── layout.tsx           en-tête, pied, barre d'action mobile
│   ├── page.tsx             accueil
│   ├── [service]/           4 pages de service
│   ├── nettoyage-fin-de-chantier/
│   │   ├── page.tsx         page mère (requête principale)
│   │   └── [commune]/       8 pages locales
│   ├── reservation/         parcours de devis (déplacé depuis (public))
│   ├── devis/ realisations/ professionnels/ a-propos/ contact/
│   └── mentions-legales/ confidentialite/ conditions-generales/
├── (app)/           ← SUITON OS : session obligatoire, noindex
├── (auth)/          ← connexion
└── portail/         ← accès par jeton, noindex, interdit aux robots
```

---

## 2. Le socle éditorial

Trois fichiers pilotent l'ensemble : les pages, les métadonnées, le JSON-LD,
le sitemap et le maillage interne.

| Fichier                      | Contenu                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/lib/site/services.ts`   | 5 services : h1, title, description, accroche, problème, inclus, exclus, déroulement, prix, durée, FAQ, connexes |
| `src/lib/site/communes.ts`   | 8 communes : contexte, parc immobilier, spécificités, quartiers, voisines, services phares                       |
| `src/lib/site/entreprise.ts` | identité, garanties, étapes client                                                                               |

Ajouter une commune, c'est ajouter une entrée dans `COMMUNES` : la page, le
sitemap, le maillage du pied de page et les liens de proximité suivent.

**Les huit pages locales ont un contenu réellement différent.** Ce n'est pas
un scrupule esthétique : huit pages produites par le même gabarit avec
seulement le nom qui change ne sont pas huit pages, c'est une page dupliquée
huit fois, et Google la traite comme telle. L'audit mesure cette unicité en
n-grammes et échoue en dessous de 35 % de contenu propre. Mesure actuelle :
**44,4 % à 49,1 %**.

Ce que ces pages disent réellement, commune par commune :

- **Enghien** — siège de l'entreprise, frontière linguistique, trois époques de bâti, stationnement contraint dans le centre ancien
- **Nivelles** — forte construction neuve au sud et à l'est, délais de réception serrés, rénovation lourde autour de la collégiale
- **Braine-l'Alleud** — grandes surfaces vitrées, villas
- **Waterloo** — biens de standing, rotations locatives
- **Bruxelles** — appartements en étage, protection des communs, contraintes d'accès
- **Tubize** — poussière abrasive des reconversions industrielles
- **Hal / Halle** — zone principale, néerlandophone
- **Saint-Pieters-Leeuw** — parc homogène

---

## 3. Architecture SEO

| Élément                                         | Où                                                                   | Vérifié par |
| ----------------------------------------------- | -------------------------------------------------------------------- | ----------- |
| `title`, `description`, canonique, robots       | `metadonnees()` dans `src/lib/site/seo.tsx`                          | audit §2    |
| Open Graph + Twitter Cards                      | idem, image `public/og.png` (1200 × 630)                             | audit §2    |
| JSON-LD `LocalBusiness`                         | injecté une fois dans `(site)/layout.tsx`, `areaServed` = 8 communes | audit §2    |
| JSON-LD `Service` + `UnitPriceSpecification`    | pages de service                                                     | audit §2    |
| JSON-LD `FAQPage`                               | accueil, services, communes, devis, professionnels                   | audit §2    |
| JSON-LD `BreadcrumbList` + fil d'Ariane visible | toutes les pages profondes                                           | audit §2    |
| `sitemap.xml`                                   | `src/app/sitemap.ts`, généré depuis `SERVICES` et `COMMUNES`         | audit §2    |
| `robots.txt`                                    | `src/app/robots.ts`                                                  | audit §2    |
| Maillage interne                                | pied de page (5 services × 8 communes), connexes, voisines           | audit §5    |

**Le portail client est interdit aux robots.** Ses URL contiennent un jeton
d'accès : une seule page indexée exposerait le dossier d'un client dans les
résultats de recherche. `robots.ts` l'interdit, les pages posent
`robots: noindex, nocache`, et l'audit échoue si l'une des deux protections
disparaît.

---

## 4. Performance

### Ce qui a été fait, et pourquoi

**Les polices sont chargées par `next/font/local`** (`src/app/fonts.ts`), pas
par les feuilles `@fontsource`. Trois effets mesurés :

1. Next émet un `<link rel="preload">` pour les fichiers réellement utilisés.
   Sans cela, la requête de police ne part qu'après l'analyse du CSS — après
   le chemin critique, exactement au mauvais moment pour un H1.
2. Seuls les sous-ensembles latins sont embarqués. Les feuilles `@fontsource`
   déclaraient **45 `@font-face`** (cyrillique, grec, vietnamien) : 14 ko de
   CSS bloquant pour des alphabets qu'un site belge francophone n'affichera
   jamais. CSS passé de 53,9 ko à **39,1 ko**.
3. `adjustFontFallback` calcule un `size-adjust` sur la police de repli. Le
   texte affiché pendant le chargement occupe la même place que le texte
   final : la substitution ne décale plus rien, et le CLS ne dépend plus de la
   vitesse du réseau.

Jura 400 a été retiré : les titres ne sont jamais rendus en 400. 14 ko de
moins sur le chemin critique.

**Le middleware n'appelle plus Supabase sur les pages publiques.** La logique
a été inversée : au lieu d'une liste blanche de chemins publics, une liste
noire de chemins protégés. Un visiteur de suiton.be n'a pas de session et n'en
aura jamais — lui faire payer un aller-retour Supabase par navigation était un
coût pur sur le TTFB.

**La grille tarifaire est lue à la régénération, pas à la visite.** Les pages
sont en ISR (`revalidate = 3600` sur l'accueil et le devis, `86400` sur les
services et les communes). `grillePublique()` a un repli sur le catalogue : si
Supabase est indisponible au moment d'une régénération, le site affiche une
estimation plutôt qu'une erreur 500. Le devis, lui, reste toujours recalculé
côté serveur.

### Budgets tenus (mesurés sur la sortie de build)

| Budget                           | Seuil  | Mesure                   |
| -------------------------------- | ------ | ------------------------ |
| CSS bloquant                     | 45 ko  | **39,1 ko**              |
| Polices préchargées              | 110 ko | **98,4 ko** (5 fichiers) |
| JS partagé                       | 110 ko | **102 ko**               |
| HTML compressé, pire page        | 30 ko  | **21,9 ko**              |
| Ressources tierces dans le rendu | 0      | **0**                    |

### Ce qui n'a pas pu être mesuré ici

**Lighthouse, LCP, CLS et INP n'ont pas été mesurés.** Ces métriques exigent
un navigateur réel qui charge la page depuis un serveur ; aucun script Node ne
peut les simuler honnêtement. `scripts/audit-site.mjs` vérifie les causes
habituelles d'un mauvais score, pas le score.

La mesure réelle se fait après le premier déploiement (§6, étape 7). Les
choix ci-dessus — aucune ressource tierce, aucune image dans le premier écran,
polices préchargées avec métriques de repli ajustées, HTML statique — sont ceux
qui produisent les bons scores, mais c'est PageSpeed Insights qui tranche, pas
moi.

---

## 5. Accessibilité

Vérifié automatiquement sur les 23 pages générées :

- `lang="fr-BE"` sur `<html>`
- exactement un `<h1>` par page, aucune hiérarchie de titres sautée
- aucun lien ni bouton sans intitulé accessible
- tout champ de formulaire étiqueté (`for`, `aria-label`, ou `<label>` enveloppant)
- lien d'évitement « Aller au contenu » en tête de chaque page
- cibles tactiles à 44 px (`--spacing-touch`), utilisables avec des gants
- `:focus-visible` sur tout élément interactif
- `prefers-reduced-motion` respecté

Le contraste des couleurs n'est pas vérifié par le script : il l'a été à la
conception du système (Abysse sur Minéral, Aqua profond `#1E6E78` réservé au
texte aqua sur fond clair, précisément parce que `#5FC2CE` ne passe pas le
ratio 4,5:1 sur blanc).

---

## 6. Mise en ligne

### Prérequis

- domaine `suiton.be` chez le registrar (DNS Belgium ou revendeur)
- projet Supabase de production, migrations appliquées (`docs/MISE-EN-PRODUCTION.md`)
- compte Vercel

### Étape 1 — variables d'environnement Vercel

Dans **Settings → Environment Variables**, pour `Production` :

```
NEXT_PUBLIC_SITE_URL         = https://suiton.be
NEXT_PUBLIC_SUPABASE_URL     = https://<projet>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY= <clé anon>
SUPABASE_SERVICE_ROLE_KEY    = <clé service_role>
PORTAL_TOKEN_PEPPER          = <openssl rand -base64 32>
RESEND_API_KEY               = <clé>
CRON_SECRET                  = <openssl rand -base64 32>
```

`NEXT_PUBLIC_SITE_URL` doit être **exactement** `https://suiton.be`, sans barre
finale : toutes les URL canoniques et le sitemap en dérivent. Une barre en trop
produit des canoniques en `https://suiton.be//devis`.

### Étape 2 — domaine

Dans **Settings → Domains**, ajouter `suiton.be` et `www.suiton.be`.

DNS chez le registrar :

```
A     suiton.be       76.76.21.21
CNAME www.suiton.be   cname.vercel-dns.com
```

Régler la redirection sur **`www` → apex** (`suiton.be` en domaine principal).
Les canoniques pointent sur l'apex : si `www` reste servi sans redirection,
chaque page existe à deux adresses.

Vérifier après propagation :

```bash
curl -sI https://www.suiton.be | grep -i location   # doit renvoyer https://suiton.be/
curl -s  https://suiton.be/robots.txt
curl -s  https://suiton.be/sitemap.xml | head -20
```

### Étape 3 — vérification avant déploiement

```bash
npm run verify
```

Enchaîne typecheck, lint, 242 tests, build, audit du site. Aucun déploiement
si l'un échoue.

### Étape 4 — déploiement

```bash
vercel --prod
```

Ou en poussant sur `main` si l'intégration Git est active.

### Étape 5 — contrôles après mise en ligne

```bash
# Les pages répondent 200
for u in / /nettoyage-fin-de-chantier /nettoyage-fin-de-chantier/enghien \
         /nettoyage-de-vitres /devis /professionnels /realisations /contact; do
  printf '%-45s %s\n' "$u" "$(curl -s -o /dev/null -w '%{http_code}' https://suiton.be$u)"
done

# L'espace de gestion redirige vers la connexion
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://suiton.be/tableau-de-bord

# Une URL inventée renvoie bien 404, pas 200
curl -s -o /dev/null -w '%{http_code}\n' https://suiton.be/nettoyage-de-piscine
```

### Étape 6 — Search Console

1. Ajouter la propriété **Domaine** `suiton.be` (couvre apex, www, http, https).
2. Valider par enregistrement TXT DNS.
3. **Sitemaps** → soumettre `sitemap.xml`.
4. **Inspection d'URL** → demander l'indexation de l'accueil et des huit pages
   locales, une par une. Ne pas attendre la découverte spontanée : sur un
   domaine neuf elle prend des semaines.

Contrôler à J+7 : la couverture doit afficher 20 pages valides. Une page en
« Détectée, actuellement non indexée » sur un site neuf est normale ; la même
page dans cet état à J+30 signale un problème de contenu ou de maillage.

### Étape 7 — mesurer la performance réelle

Une fois le domaine actif :

1. https://pagespeed.web.dev/ sur l'accueil, une page de service, une page
   locale, en **Mobile**.
2. Relever LCP, CLS, INP et le score global.
3. Objectifs : Lighthouse > 95, LCP < 1,8 s, CLS < 0,05, INP < 150 ms.
4. Consigner les valeurs dans ce document, avec la date.

Si le LCP dépasse la cible, l'ordre d'investigation est : TTFB (région Vercel
et ISR), puis les polices, puis le JS. Sur ce site il n'y a aucune image dans
le premier écran — le LCP est un bloc de texte, ce qui est le cas favorable.

### Étape 8 — Google Business Profile

Créer la fiche depuis l'adresse d'Enghien :

- **Catégorie principale** : Service de nettoyage — **Secondaire** : Entreprise de nettoyage après chantier
- **Zone desservie** : les huit communes, pas un rayon
- **NAP identique au site, au caractère près** : `SUITON`, `Rue Boussart 7,
7850 Enghien`, `0489 21 01 24`. Une divergence entre la fiche et le site
  affaiblit le signal local.
- Site web : `https://suiton.be`
- Horaires : ceux de `ENTREPRISE.horaires`

**Ne jamais filtrer les demandes d'avis.** Ne solliciter que les clients
satisfaits est interdit par Google et fait supprimer les avis obtenus. La
sollicitation doit être identique pour tout le monde — c'est ce que fait
l'automatisation `avis_google`.

---

## 7. Entretien

| Fréquence                        | Action                                                                                        |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| À chaque modification de contenu | `npm run verify`                                                                              |
| Mensuel                          | Search Console : couverture, requêtes, pages en baisse                                        |
| Mensuel                          | PageSpeed sur trois pages, consigner les valeurs                                              |
| Trimestriel                      | Relire les huit pages locales — le parc immobilier d'une commune évolue                       |
| À chaque changement de grille    | Vérifier que le calculateur affiche la nouvelle grille après la fenêtre de revalidation (1 h) |

### Ajouter une commune

1. Ajouter l'entrée dans `COMMUNES` avec un contexte **réellement local** :
   parc immobilier, quartiers, contraintes d'accès. Pas une reformulation
   d'une commune voisine.
2. Ajouter le slug dans les `voisines` d'au moins une commune existante,
   sinon la page n'aura aucun lien entrant depuis le corps du site.
3. `npm run verify` — les tests `src/tests/site.test.ts` refusent un contexte
   de moins de 60 mots, des spécificités recopiées d'une autre commune, un
   titre hors gabarit ou une page orpheline.
4. Déployer, puis demander l'indexation dans Search Console.

### Ajouter un service

Même logique dans `SERVICES`. La page, le sitemap, le pied de page et le
JSON-LD suivent automatiquement. Penser à le référencer dans les `connexes`
d'un service existant.
