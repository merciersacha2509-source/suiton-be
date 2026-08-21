# suiton.be — dossier de mise en production

**Date de l'audit :** 14 août 2026
**Version auditée :** SUITON OS 1.0, 23 migrations, 20 pages publiques indexables
**Verdict :** ✅ **GO** — sous réserve des cinq actions humaines listées au § 9

---

## 0. Ce que cet audit prouve, et ce qu'il ne prouve pas

Un rapport de mise en production qui ne dit pas où s'arrête sa mesure n'est
pas un rapport, c'est une brochure. Voici la frontière.

**Mesuré réellement, sur cette machine, avec des valeurs reproductibles :**

- 23 migrations appliquées sur un PostgreSQL 18 réel, monté pour l'occasion
- 117 assertions SQL sur le schéma, la RLS, les contraintes, la numérotation
- 58 contrôles fonctionnels de bout en bout, en HTTP, sur le serveur de production
- 65 contrôles de sécurité, dont le retrait des métadonnées GPS vérifié sur une vraie image
- TTFB, poids transférés, tenue sous charge, comportement de l'ISR
- 242 tests unitaires, typecheck, lint, audit du site

**Non mesuré, et non estimé :**

- **Lighthouse, LCP, CLS, INP.** Ces métriques décrivent ce qu'un navigateur
  réel fait en peignant une page réelle. Il n'y a pas de navigateur dans cet
  environnement — le téléchargement de Chromium y est bloqué — et aucun script
  Node ne peut les produire. Les inventer serait pire que ne rien annoncer.
  Le § 7 donne la procédure exacte pour les relever et un tableau à remplir.
- **Le comportement de Vercel et de Supabase en production.** Démarrage à
  froid, latence réseau, cache du CDN : ils se mesurent une fois en ligne.
- **PostgREST et GoTrue.** Les tests de bout en bout passent par une passerelle
  PostgREST minimale écrite pour l'occasion (`scripts/prod/postgrest-shim.mjs`),
  qui traduit les appels de supabase-js en SQL sur la vraie base. Elle prouve
  que **notre** code est correct de la requête HTTP jusqu'à la ligne écrite.
  Elle ne teste pas Supabase lui-même, ce qui n'est pas notre rôle.

Le TTFB relevé au § 4 est celui du **rendu**. En production s'y ajoute la
latence jusqu'au point de présence — typiquement 20 à 60 ms depuis la
Belgique vers Francfort.

---

## 1. Rapport d'audit — synthèse

| Domaine                                      | Contrôles | Résultat                       |
| -------------------------------------------- | --------: | ------------------------------ |
| Typecheck TypeScript strict                  |         — | ✅ 0 erreur                    |
| ESLint                                       |         — | ✅ 0 erreur, 0 avertissement   |
| Tests unitaires (Vitest)                     |       242 | ✅ 242 / 242                   |
| Audit du site (SEO, a11y, budgets, maillage) |  23 pages | ✅ 0 problème, 0 avertissement |
| Schéma et RLS sur PostgreSQL réel            |       117 | ✅ 117 / 117                   |
| Fonctionnel bout en bout en HTTP             |        58 | ✅ 58 / 58                     |
| Sécurité                                     |        65 | ✅ 65 / 65                     |
| **Total**                                    |   **505** | **✅ 505 / 505**               |

### 1.1 Fonctionnel

| Élément                                          | Statut | Preuve                                               |
| ------------------------------------------------ | ------ | ---------------------------------------------------- |
| 20 pages publiques répondent 200                 | ✅     | § 3, bloc 1                                          |
| URL inventée → 404 (pas 200)                     | ✅     | `/nettoyage-de-piscine` → 404                        |
| Espace de gestion → redirection connexion        | ✅     | 4 routes testées, 307                                |
| Calculateur = moteur de devis                    | ✅     | 980–1120 € affichés = grille × surface               |
| Réservation complète → client + chantier + jeton | ✅     | `SUITON-2026-0017` créé                              |
| Création de chantier atomique                    | ✅     | `create_booking()`, une transaction                  |
| Devis : numérotation continue                    | ✅     | `next_number` sans trou                              |
| Portail client par jeton                         | ✅     | 200 avec le jeton, 404 si un caractère change        |
| Créneaux réellement libres                       | ✅     | 40 créneaux, le premier accepté par la base          |
| E-mails transactionnels                          | ⚠️     | Rendus corrects, envoi non testé (voir § 9.3)        |
| Navigation, maillage interne                     | ✅     | 0 lien cassé, 0 page orpheline                       |
| Responsive                                       | ⚠️     | Structure vérifiée, rendu visuel non vérifié (§ 9.5) |

### 1.2 Technique

| Élément                                                  | Statut | Valeur                           |
| -------------------------------------------------------- | ------ | -------------------------------- |
| Build Next 15.5.23                                       | ✅     | Compilé en 2,4 s                 |
| 23 migrations                                            | ✅     | Appliquées en 60 ms              |
| 35 tables, toutes avec RLS                               | ✅     | 0 table nue                      |
| 31 fonctions métier, 20 vues, 24 déclencheurs, 130 index | ✅     | —                                |
| 25 fonctions SECURITY DEFINER                            | ✅     | Toutes fixent leur `search_path` |
| Toutes les vues en `security_invoker`                    | ✅     | 20 / 20                          |
| ISR actif                                                | ✅     | `x-nextjs-cache: HIT`            |
| Middleware : Supabase non appelé sur les pages publiques | ✅     | § 5.2                            |
| Variables d'environnement validées au démarrage          | ✅     | Zod, échec au boot               |

### 1.3 SEO

| Élément                                   | Statut | Valeur                                                         |
| ----------------------------------------- | ------ | -------------------------------------------------------------- |
| Titres uniques, 30–65 caractères          | ✅     | 20 / 20                                                        |
| Meta descriptions uniques, 70–165         | ✅     | 20 / 20                                                        |
| Un seul H1 par page, aucun saut de niveau | ✅     | 23 / 23                                                        |
| Canoniques                                | ✅     | 23 / 23, aucune en double                                      |
| JSON-LD                                   | ✅     | LocalBusiness, Service, FAQPage, BreadcrumbList — tous valides |
| Sitemap                                   | ✅     | 20 URL, aucune page indexable absente, aucune noindex présente |
| robots.txt                                | ✅     | `/portail/`, `/api/` et l'espace de gestion interdits          |
| Open Graph + Twitter Cards                | ✅     | Image 1200 × 630 servie depuis le domaine                      |
| Unicité des pages locales                 | ✅     | 44,4 % à 49,1 % de contenu propre (seuil 35 %)                 |

### 1.4 Sécurité

| Élément                                                                     | Statut                                   |
| --------------------------------------------------------------------------- | ---------------------------------------- |
| En-têtes : CSP, HSTS, nosniff, DENY, no-referrer, COOP                      | ✅                                       |
| `anon` et `authenticated` ne lisent aucune donnée client                    | ✅ 28 tables × rôles                     |
| `anon` ne peut pas créer de chantier en direct                              | ✅                                       |
| Jetons de portail : 32 octets aléatoires, SHA-256 + poivre, jamais en clair | ✅                                       |
| Aucun secret serveur dans les 63 fichiers envoyés au navigateur             | ✅                                       |
| Limitation de débit sur les 3 routes publiques                              | ✅ coupure à la 11ᵉ requête              |
| Uploads : MIME restreint, taille plafonnée, ré-encodage sharp               | ✅                                       |
| **EXIF/GPS réellement supprimés**                                           | ✅ vérifié sur une image porteuse de GPS |
| Fichier non-image renommé en `.jpg` rejeté                                  | ✅                                       |
| Aucun composant client n'importe le client admin                            | ✅                                       |

---

## 2. Liste des corrections apportées pendant l'audit

Cinq corrections, toutes issues d'un défaut constaté, pas d'une intuition.

### C1 — 25 clés étrangères non indexées · **majeur**

**Constat.** PostgreSQL n'indexe pas le côté enfant d'une clé étrangère. À
chaque suppression d'une ligne parente, il doit vérifier qu'aucun enfant ne la
référence — sans index, c'est un parcours complet de la table enfant.

Trois chemins rendaient cela critique :

- `events.client_id` est en `ON DELETE CASCADE` et `events` est la table la
  plus volumineuse. **L'effacement RGPD d'un client parcourait toute la
  table.** C'est une obligation légale avec un délai d'un mois : ce n'est pas
  l'opération qu'on veut voir expirer.
- Douze tables référencent `profiles` en `ON DELETE SET NULL` : supprimer un
  compte les parcourait toutes.
- Lectures quotidiennes : photos par intervention, factures par devis, chaîne
  de versions d'un document.

**Correction.** Migration `20261101000100_index_cles_etrangeres.sql`, 25 index,
partiels sur les colonnes nullables. Vérifié : 0 clé étrangère non indexée.

### C2 — 7 secondes de blocage sur la page de réservation · **majeur**

**Constat.** Mesuré en conditions dégradées : **TTFB de 7 046 ms** sur
`/reservation`. Le repli sur le catalogue fonctionnait — mais sept secondes
après. Aucun plafond n'était posé sur la lecture de la grille tarifaire : une
base injoignable ne provoquait pas une erreur, elle provoquait une attente.

**Correction.** `AbortSignal` à 2 secondes dans `grillePublique()`.
**TTFB après correction : 6,5 ms** (médiane, 15 requêtes).

### C3 — Absence de Content-Security-Policy · **moyen**

**Constat.** HSTS, nosniff, X-Frame-Options et Referrer-Policy étaient posés.
La CSP manquait.

**Correction.** CSP ajoutée avec `object-src 'none'`, `base-uri 'self'`,
`form-action 'self'`, `frame-ancestors 'none'`, `connect-src` limité à
Supabase, `upgrade-insecure-requests`. Plus `Cross-Origin-Opener-Policy`.

**Choix assumé :** `script-src` autorise `'unsafe-inline'`. Next injecte la
charge utile React Server Components dans des balises `<script>` en ligne ;
les interdire suppose une CSP à nonce, donc un nonce par réponse, donc le
**rendu dynamique des vingt pages**. On échangerait 2 ms de TTFB contre
plusieurs dizaines, en permanence, sur tout le site. Le site ne charge aucun
script tiers et n'affiche aucun HTML fourni par un utilisateur : le vecteur
laissé ouvert suppose déjà une exécution de code arbitraire côté serveur, et à
ce stade la CSP n'est plus la ligne de défense pertinente. **À revoir le jour
où le site accepte du HTML extérieur.**

### C4 — Erreurs internes sur les URL inconnues · **mineur**

**Constat.** `dynamicParams = false` renvoyait bien 404, mais faisait remonter
une `NoFallbackError` dans les journaux à chaque URL sondée par un robot. Des
erreurs internes par centaines pour un comportement nominal finissent par
masquer les vraies pannes.

**Correction.** `dynamicParams = true` + `notFound()` explicite. Même 404,
journaux propres.

### C5 — Mesure d'audience absente · **mineur**

**Correction.** Vercel Web Analytics et Speed Insights activés : sans cookie,
sans identifiant persistant, servis depuis le domaine, **donc sans bannière**.
Speed Insights remonte les Core Web Vitals réels des visiteurs — la seule
mesure de LCP, CLS et INP qui vaille vraiment, celle du terrain.

Google Analytics est implémenté mais **inactif** tant que `NEXT_PUBLIC_GA_ID`
n'est pas défini. S'il est activé, le script n'est chargé qu'après un
consentement explicite, avec « Refuser » aussi visible que « Accepter ».

> **Recommandation.** Rester sur Vercel Analytics. GA n'apporterait, pour ce
> site, presque rien de plus, et coûterait une bannière sur chaque page de
> vente. Si vous tenez à GA pour Google Ads, activez-le à ce moment-là, pas
> avant.

---

## 3. Commandes exactes

### 3.1 Vérification complète avant tout déploiement

```bash
npm run go-live
```

Enchaîne, dans l'ordre, et s'arrête au premier échec :

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # eslint .
npm run test           # 242 tests
npm run build          # next build
npm run audit          # 23 pages : SEO, a11y, budgets, maillage
npm run prod:db        # 23 migrations sur PostgreSQL réel
npm run prod:schema    # 117 assertions schéma + RLS
npm run prod:e2e       # 58 contrôles HTTP bout en bout
npm run prod:securite  # 65 contrôles de sécurité
```

Chaque étape est lançable seule. `SUITON_SKIP_BUILD=1` évite de reconstruire
entre deux scripts.

### 3.2 Base de production Supabase

```bash
supabase link --project-ref <ref-du-projet>
supabase db push                    # applique les 23 migrations
supabase db push --dry-run          # à lancer d'abord, toujours
npm run db:types                    # régénère src/types/database.ts
```

### 3.3 Vercel

```bash
npm i -g vercel
vercel login
vercel link

# Variables — Production uniquement
vercel env add NEXT_PUBLIC_SITE_URL production          # https://suiton.be
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add PORTAL_TOKEN_PEPPER production           # openssl rand -base64 32
vercel env add RESEND_API_KEY production
vercel env add RESEND_FROM production                   # SUITON <no-reply@suiton.be>
vercel env add NOTIFY_EMAIL production                  # suiton.detailing@gmail.com
vercel env add CRON_SECRET production                   # openssl rand -base64 32

vercel --prod
```

`NEXT_PUBLIC_SITE_URL` doit valoir **exactement** `https://suiton.be`, sans
barre finale : toutes les canoniques et le sitemap en dérivent.

> **Piège Next.js.** Les variables `NEXT_PUBLIC_*` sont figées **à la
> compilation**. Les modifier après coup n'a aucun effet tant qu'on n'a pas
> redéployé. C'est ce qui a d'abord fait échouer les tests de bout en bout de
> cet audit.

### 3.4 Domaine et DNS

```bash
vercel domains add suiton.be
vercel domains add www.suiton.be
```

Chez le registrar :

```
A       suiton.be         76.76.21.21
CNAME   www.suiton.be     cname.vercel-dns.com
```

Régler `suiton.be` en domaine **principal** et `www` en redirection. Les
canoniques pointent sur l'apex : si `www` reste servi sans redirection, chaque
page existe à deux adresses.

TLS : Vercel émet et renouvelle le certificat Let's Encrypt automatiquement
dès la propagation. Aucune action.

### 3.5 Contrôles après mise en ligne

```bash
# Codes de réponse
for u in / /nettoyage-fin-de-chantier /nettoyage-fin-de-chantier/enghien \
         /nettoyage-de-vitres /devis /professionnels /realisations /contact \
         /a-propos /reservation /sitemap.xml /robots.txt; do
  printf '%-45s %s\n' "$u" "$(curl -s -o /dev/null -w '%{http_code}' https://suiton.be$u)"
done

# www redirige vers l'apex
curl -sI https://www.suiton.be | grep -i '^location'

# HTTP redirige vers HTTPS
curl -sI http://suiton.be | grep -iE '^(HTTP|location)'

# En-têtes de sécurité
curl -sI https://suiton.be | grep -iE 'strict-transport|content-security|x-frame|x-content|referrer'

# TTFB réel, dix mesures
for i in $(seq 1 10); do
  curl -s -o /dev/null -w '%{time_starttransfer}\n' https://suiton.be/
done

# Une URL inventée doit renvoyer 404, pas 200
curl -s -o /dev/null -w '%{http_code}\n' https://suiton.be/nettoyage-de-piscine

# L'espace de gestion redirige
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://suiton.be/tableau-de-bord

# Le portail n'est pas indexable
curl -s https://suiton.be/robots.txt | grep portail
```

### 3.6 Test de bout en bout sur la production

À faire **une seule fois**, avec votre propre adresse, puis supprimer le
chantier de test depuis l'espace de gestion.

```bash
curl -s -X POST https://suiton.be/api/booking \
  -H 'content-type: application/json' \
  -d '{"service":"fin_de_chantier","property_type":"maison","soil":"standard",
       "surface_m2":140,"commune":"Enghien","code_postal":"7850",
       "adresse":"Rue Boussart 7","urgent":false,"photos":[],
       "nom":"Test Production","email":"merciersacha2509@gmail.com",
       "telephone":"0489 21 01 24","est_pro":false,
       "consent_photos":false,"consent_cgv":true}' | jq
```

Attendu : `201`, une référence `SUITON-2026-XXXX`, un lien de portail, une
estimation de 980–1120 €, **et un courriel dans votre boîte**. C'est le seul
contrôle qui valide réellement l'envoi d'e-mails.

---

## 4. Métriques réelles

Serveur de production Next 15.5.23, PostgreSQL 18 local, 15 requêtes par page
après chauffe.

### 4.1 TTFB de rendu

| Page                      |    Médiane |     p95 |     HTML |
| ------------------------- | ---------: | ------: | -------: |
| Accueil                   | **2,7 ms** |  4,2 ms | 131,5 ko |
| Nettoyage fin de chantier | **2,0 ms** |  4,4 ms |  97,8 ko |
| Page locale (Enghien)     | **1,8 ms** |  2,1 ms |  84,4 ko |
| Nettoyage de vitres       | **1,8 ms** |  4,5 ms |  89,5 ko |
| Devis                     | **1,5 ms** |  3,9 ms |  74,6 ko |
| Professionnels            | **1,7 ms** |  1,8 ms |  82,1 ko |
| Réservation (dynamique)   | **6,5 ms** | 11,8 ms |  42,9 ko |

_Réservation était à 7 046 ms avant la correction C2._

### 4.2 Poids transféré — accueil, première visite

| Ressource           |        Brut |           gzip |      brotli |
| ------------------- | ----------: | -------------: | ----------: |
| HTML                |    131,5 ko |        22,1 ko | **14,4 ko** |
| CSS bloquant        |     39,3 ko |     **7,9 ko** |           — |
| JS (11 fichiers)    |    513,2 ko |       160,1 ko |           — |
| Polices woff2 (5)   | **98,4 ko** | déjà compressé |           — |
| **Chemin critique** |    269,2 ko |   **128,4 ko** |           — |

Le chemin critique — ce qui doit arriver avant le premier rendu — est
HTML + CSS bloquant + polices préchargées. Le JS arrive après et n'entre pas
dans le LCP d'une page dont le plus grand élément est un bloc de texte.

**Le point faible, dit franchement :** 160 ko de JS compressé sur l'accueil.
L'essentiel est le socle React et Next ; le reste vient du calculateur, qui
est un composant interactif placé dans le premier écran. C'est un choix de
conversion assumé : c'est l'élément qui transforme un visiteur en demande de
devis. Si les mesures terrain montrent un INP dégradé sur mobile d'entrée de
gamme, la piste est de charger le calculateur en différé à la première
interaction — au prix d'une conversion probablement plus faible. **À décider
sur données, pas avant.**

### 4.3 Tenue sous charge — 100 requêtes, 20 en parallèle

| Page                    |         Débit | Médiane |     p95 | Erreurs |
| ----------------------- | ------------: | ------: | ------: | ------: |
| Accueil (statique)      | **840 req/s** | 22,2 ms | 24,5 ms |       0 |
| Réservation (dynamique) | **255 req/s** | 76,2 ms | 95,1 ms |       0 |

### 4.4 Routes API

| Route                              | Médiane |    p95 |
| ---------------------------------- | ------: | -----: |
| `/api/health`                      |  1,3 ms | 2,6 ms |
| `/api/slots`                       |  3,2 ms | 7,4 ms |
| `/api/booking` (écriture complète) |    7 ms |      — |

### 4.5 Budgets tenus

| Budget                           |  Seuil |     Mesure |
| -------------------------------- | -----: | ---------: |
| CSS bloquant                     |  45 ko | 39,3 ko ✅ |
| Polices préchargées              | 110 ko | 98,4 ko ✅ |
| JS partagé                       | 110 ko |  103 ko ✅ |
| HTML compressé, pire page        |  30 ko | 22,1 ko ✅ |
| Ressources tierces dans le rendu |      0 |       0 ✅ |

---

## 5. Preuves des tests

Sortie brute conservée dans `docs/preuves/`.

### 5.1 Fonctionnel — extrait de `prod:e2e` (58 / 58)

```
1. Pages publiques
  ok  /                                      200 — 12 ms
  ok  /nettoyage-fin-de-chantier/enghien     200 —  6 ms
  ok  /nettoyage-de-piscine                  404 — attendu 404

2. Espace de gestion — redirection vers la connexion
  ok  /tableau-de-bord protege — 307 -> /connexion

4. Validation de la reservation
  ok  corps vide                       422
  ok  montant impose par le client     201
  ok  surface absurde                  422
  ok  champ piege rempli               422
  ok  le montant envoye par le client est ignore — estimation recalculee : 980.00–1120.00 €

5. Reservation nominale — chaine complete
  ok  POST /api/booking -> 201 — 7 ms
  ok  reference attribuee — SUITON-2026-0017
  ok  un client cree — marie.dupont@example.be
  ok  jeton de portail hache en base — sha256, 64 caracteres
  ok  consentement photo date
  ok  score et bande calcules par la base — score 50, bande C
  ok  prix en base = grille × surface — 980.00–1120.00 € pour 140 m² à 7–8 €/m²

6. Portail client avec le vrai jeton
  ok  le portail s'ouvre avec le jeton emis — 200
  ok  la visite du portail est tracee — hits=1
  ok  un jeton modifie d'un caractere est refuse — 404

7. Limitation de debit
  ok  la limitation coupe le flot — refus a la tentative n° 11
  ok  la limitation est bien par IP — 201

8. Creneaux
  ok  GET /api/slots renvoie des creneaux reellement libres — 40 creneaux, duree 280–390 min
  ok  le premier creneau propose est acceptable par la base
```

### 5.2 Sécurité — extrait de `prod:securite` (65 / 65)

```
A. En-tetes HTTP
  ok  content-security-policy — default-src 'self'; script-src 'self' 'unsafe-inline';
      object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self';
      connect-src 'self' https://<projet>.supabase.co; upgrade-insecure-requests
  ok  strict-transport-security — max-age=63072000; includeSubDomains; preload
  ok  aucun en-tete x-powered-by

B. Isolation des donnees
  ok  « anon » ne lit rien dans clients — 0 ligne(s)
  ok  « anon » ne lit rien dans jobs — acces refuse
  ok  « authenticated » ne lit rien dans invoices — acces refuse
  ok  « anon » ne peut pas creer de chantier en direct
      (28 combinaisons role × table)

C. Surface exposee
  ok  aucun jeton stocke en clair
  ok  image de test porteuse d'EXIF — 228 octets
  ok  EXIF/GPS reellement supprimes a l'ingestion — aucune metadonnee
  ok  un fichier renomme en .jpg est rejete par le traitement
  ok  aucun secret serveur dans les 63 fichiers envoyes au navigateur
  ok  aucun composant client n'importe le client admin
```

Le contrôle EXIF n'est pas une lecture de code : le script fabrique une image
JPEG porteuse de coordonnées GPS, la fait passer par le traitement réel, et
relit le résultat. La page « confidentialité » affirme que les positions sont
supprimées à l'ingestion — une affirmation de ce type se teste.

### 5.3 Schéma — `prod:schema` (117 / 117)

```
23/23 migrations appliquees en 60 ms
35 tables dans public — toutes avec RLS activee
31 fonctions metier, 20 vues, 24 declencheurs, 130 index

  ok  numerotation continue SUITON-2026-0001 -> SUITON-2026-0002
  ok  12:15 — dans le tampon de 30 min — rejetee [pas_de_chevauchement]
  ok  B2B EMISE sans Peppol REJETEE [b2b_peppol]
  ok  autoliquidation avec TVA non nulle rejetee
  ok  Toutes les cles etrangeres sont indexees
  ok  Toutes les vues sont en security_invoker
  ok  25 fonctions SECURITY DEFINER fixent leur search_path
```

---

## 6. Procédure de mise en ligne

Ordre strict. Chaque étape se vérifie avant la suivante.

| #   | Étape                                                             | Vérification        | Rollback              |
| --- | ----------------------------------------------------------------- | ------------------- | --------------------- |
| 1   | `npm run go-live` en local                                        | 505 / 505           | —                     |
| 2   | Créer le projet Supabase en **région UE (Francfort)**             | Projet actif        | Supprimer le projet   |
| 3   | `supabase db push --dry-run` puis `supabase db push`              | 23 migrations       | § 8.2                 |
| 4   | Créer les buckets Storage `chantiers` et `documents`, **privés**  | Aucun bucket public | Les supprimer         |
| 5   | Vérifier Resend : domaine `suiton.be` vérifié, SPF + DKIM publiés | Test d'envoi        | —                     |
| 6   | Renseigner les variables Vercel (§ 3.3)                           | `vercel env ls`     | —                     |
| 7   | `vercel --prod`                                                   | Déploiement vert    | § 8.1                 |
| 8   | Ajouter les domaines, régler le DNS (§ 3.4)                       | Certificat émis     | Retirer le domaine    |
| 9   | Contrôles § 3.5                                                   | Tous verts          | § 8.1                 |
| 10  | Test de bout en bout § 3.6 avec votre adresse                     | 201 + courriel reçu | Supprimer le chantier |
| 11  | Search Console, sitemap, indexation (§ 9)                         | Sitemap accepté     | —                     |
| 12  | PageSpeed sur 3 pages, consigner (§ 7)                            | Valeurs relevées    | —                     |
| 13  | Google Business Profile (§ 9.4)                                   | Fiche en ligne      | —                     |

**Fenêtre recommandée :** mardi ou mercredi matin. Jamais un vendredi : si
quelque chose casse, on veut deux jours ouvrés devant soi, pas un week-end.

---

## 7. Procédure de mesure des performances réelles

À faire une fois le domaine actif. Ces valeurs ne peuvent pas être produites
avant.

1. Ouvrir <https://pagespeed.web.dev/>
2. Tester en **Mobile**, trois fois par page, retenir la médiane :
   - `https://suiton.be/`
   - `https://suiton.be/nettoyage-fin-de-chantier`
   - `https://suiton.be/nettoyage-fin-de-chantier/enghien`
3. Relever et consigner :

| Page                | Lighthouse | LCP | CLS | INP | TTFB | Date |
| ------------------- | ---------: | --: | --: | --: | ---: | ---- |
| Accueil             |            |     |     |     |      |      |
| Fin de chantier     |            |     |     |     |      |      |
| Page locale Enghien |            |     |     |     |      |      |

**Objectifs :** Lighthouse > 95 · LCP < 1,8 s · CLS < 0,05 · INP < 150 ms

**Si le LCP dépasse la cible**, investiguer dans cet ordre :

1. **TTFB** — région Vercel (choisir Francfort, `fra1`) et démarrage à froid.
2. **Polices** — vérifier que les cinq `<link rel="preload">` sont présents
   dans le HTML servi.
3. **JS** — voir la note du § 4.2 sur le calculateur.

Il n'y a **aucune image dans le premier écran** : le LCP est un bloc de texte,
ce qui est le cas favorable. Un LCP mauvais ici ne peut venir que du TTFB.

Après une semaine de trafic, **Vercel Speed Insights** donnera les Core Web
Vitals réels de vos visiteurs — plus fiables que PageSpeed, qui simule un
appareil et un réseau.

---

## 8. Procédure de rollback

### 8.1 Revenir au déploiement précédent — moins d'une minute

```bash
vercel ls suiton                          # lister les déploiements
vercel promote <url-du-deploiement-precedent>
```

Ou, dans l'interface : **Deployments → le précédent → Promote to Production**.

Instantané, sans reconstruction. **C'est le premier réflexe en cas de doute :
on rétablit d'abord, on comprend ensuite.**

### 8.2 Revenir sur une migration — délicat

Une migration appliquée ne s'annule pas d'un bouton. Trois cas :

| Cas                                                     | Action                                               |
| ------------------------------------------------------- | ---------------------------------------------------- |
| Migration additive (index, colonne nullable, table)     | Ne rien faire. Le code précédent l'ignore.           |
| Migration destructive (colonne supprimée, type modifié) | Restaurer une sauvegarde. Il n'y a pas de raccourci. |
| Migration bloquante (contrainte trop stricte)           | Écrire une migration corrective qui la relâche       |

**Avant toute `db push` en production :**

```bash
supabase db dump -f sauvegarde-$(date +%Y%m%d-%H%M).sql --data-only
supabase db push --dry-run       # lire la sortie, ligne par ligne
```

Supabase conserve des sauvegardes quotidiennes automatiques (7 jours en offre
Pro). **Vérifier que cette rétention est active avant le premier client réel** :
une sauvegarde qu'on découvre absente le jour où on en a besoin n'existe pas.

### 8.3 Revenir sur le DNS

Le TTL de propagation étant de quelques minutes à quelques heures, un
changement DNS raté n'est **pas** rattrapable rapidement. D'où la règle :
déployer et valider sur l'URL `*.vercel.app` **avant** de pointer le domaine.

### 8.4 En cas de fuite d'un secret

1. Faire tourner la clé chez le fournisseur (Supabase, Resend)
2. `vercel env rm <NOM> production` puis `vercel env add <NOM> production`
3. `vercel --prod` — la variable ne prend effet qu'au redéploiement
4. Si `PORTAL_TOKEN_PEPPER` a fuité : **tous les jetons de portail deviennent
   invalides après rotation.** Prévenir les clients concernés et régénérer
   leurs liens depuis l'espace de gestion.

---

## 9. Procédure d'indexation Google — et les cinq actions humaines

### 9.1 Search Console

1. <https://search.google.com/search-console> → **Ajouter une propriété** →
   type **Domaine** → `suiton.be` (couvre apex, www, http et https)
2. Valider par enregistrement **TXT DNS** chez le registrar
3. **Sitemaps** → soumettre `sitemap.xml` → attendre « Réussite »
4. **Inspection d'URL** → pour chacune des neuf URL ci-dessous →
   **Demander l'indexation**. Une par une. Ne pas attendre la découverte
   spontanée : sur un domaine neuf, elle prend des semaines.

```
https://suiton.be/
https://suiton.be/nettoyage-fin-de-chantier
https://suiton.be/nettoyage-fin-de-chantier/enghien
https://suiton.be/nettoyage-fin-de-chantier/hal
https://suiton.be/nettoyage-fin-de-chantier/nivelles
https://suiton.be/nettoyage-fin-de-chantier/braine-lalleud
https://suiton.be/nettoyage-fin-de-chantier/waterloo
https://suiton.be/nettoyage-fin-de-chantier/bruxelles
https://suiton.be/devis
```

**Contrôle à J+7 :** la couverture doit afficher 20 pages valides. Une page en
« Détectée, actuellement non indexée » sur un site neuf est normale. La même
page dans cet état à **J+30** signale un problème de contenu ou de maillage.

### 9.2 Les cinq actions que je ne peux pas faire à votre place

| #     | Action                                                                         | Pourquoi                                                            |
| ----- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| **1** | Créer le projet Supabase et pousser les migrations                             | Aucun accès à votre compte                                          |
| **2** | Déployer sur Vercel et régler le DNS                                           | Aucun identifiant, aucun accès registrar                            |
| **3** | **Vérifier le domaine chez Resend** (SPF, DKIM) et envoyer un courriel de test | Sans domaine vérifié, tous les courriels partent en spam — voir 9.3 |
| **4** | Créer la fiche Google Business Profile                                         | Vérification par courrier postal à l'adresse d'Enghien              |
| **5** | Relever Lighthouse / LCP / CLS / INP                                           | Exige un navigateur réel sur un site en ligne                       |

### 9.3 Resend — le point le plus souvent négligé

L'accusé de réception et la notification interne sont **rendus correctement**
(vérifié : le corps du message est produit, avec la bonne référence et le bon
lien de portail). L'envoi lui-même n'a pas pu être testé — il n'y a pas de clé
Resend dans cet environnement.

Avant le premier client :

1. Ajouter `suiton.be` dans Resend → **Domains**
2. Publier les enregistrements **SPF**, **DKIM** et **DMARC** fournis
3. Attendre le statut « Verified »
4. Envoyer un test à une adresse Gmail **et** à une adresse Outlook
5. Vérifier que le message n'arrive **pas** en indésirables

Sans domaine vérifié, Resend envoie depuis un domaine partagé et Gmail classe
en spam. Un accusé de réception en spam, c'est un client qui croit que sa
demande s'est perdue.

### 9.4 Google Business Profile

- **Catégorie principale :** Service de nettoyage
- **Catégorie secondaire :** Entreprise de nettoyage après chantier
- **Zone desservie :** les huit communes, nommées une par une — pas un rayon
- **NAP identique au site, au caractère près :** `SUITON`, `Rue Boussart 7,
7850 Enghien`, `0489 21 01 24`. Une divergence entre la fiche et le site
  affaiblit le signal local.
- **Site web :** `https://suiton.be`
- **Horaires :** ceux de la page « À propos »

> **Ne jamais filtrer les demandes d'avis.** Ne solliciter que les clients
> satisfaits est interdit par Google et fait supprimer les avis obtenus. La
> sollicitation doit être identique pour tout le monde.

### 9.5 Le rendu visuel n'a pas été vu

Cet audit vérifie la **structure** : un seul H1, hiérarchie de titres,
étiquettes de formulaire, cibles tactiles à 44 px, `prefers-reduced-motion`,
contrastes choisis à la conception. Il ne vérifie pas le **rendu**, faute de
navigateur.

Avant d'envoyer le premier lien à un client, ouvrir sur un vrai téléphone :

- l'accueil, en portrait et en paysage
- le calculateur : le curseur de surface est-il utilisable au pouce ?
- la barre Appeler / WhatsApp / Réserver : masque-t-elle du contenu ?
- le parcours de réservation, les six étapes, jusqu'au bout
- le portail client, avec un vrai lien

Dix minutes. C'est le seul contrôle de cette liste qui ne s'automatise pas.

---

## 10. Checklist go / no-go

**Aucun déploiement si un point est rouge.**

### Bloquants — automatisés, tous verts au 14 août 2026

- [x] `npm run typecheck` — 0 erreur
- [x] `npm run lint` — 0 erreur, 0 avertissement
- [x] `npm run test` — 242 / 242
- [x] `npm run build` — compilé
- [x] `npm run audit` — 23 pages, 0 problème
- [x] `npm run prod:db` — 23 / 23 migrations, 35 tables avec RLS
- [x] `npm run prod:schema` — 117 / 117
- [x] `npm run prod:e2e` — 58 / 58
- [x] `npm run prod:securite` — 65 / 65

### Bloquants — à valider par vous avant la mise en ligne

- [ ] Projet Supabase en région UE, migrations poussées
- [ ] Buckets `chantiers` et `documents` créés et **privés**
- [ ] Sauvegardes automatiques Supabase actives et vérifiées
- [ ] Domaine vérifié chez Resend, SPF + DKIM + DMARC publiés
- [ ] Courriel de test reçu en boîte de réception, pas en spam
- [ ] Toutes les variables Vercel renseignées en Production
- [ ] `PORTAL_TOKEN_PEPPER` généré aléatoirement, différent du développement
- [ ] Déploiement validé sur l'URL `*.vercel.app` **avant** le DNS
- [ ] `www` redirige vers l'apex
- [ ] HTTP redirige vers HTTPS, certificat valide
- [ ] Test de bout en bout § 3.6 : 201 + courriel reçu
- [ ] Chantier de test supprimé

### Non bloquants — dans les sept jours

- [ ] Search Console : propriété validée, sitemap accepté
- [ ] Neuf URL soumises à l'indexation
- [ ] Google Business Profile créé, en attente de vérification postale
- [ ] Lighthouse / LCP / CLS / INP relevés et consignés (§ 7)
- [ ] Site parcouru sur un vrai téléphone (§ 9.5)
- [ ] Couverture Search Console vérifiée à J+7

---

## 11. Après la mise en ligne

| Fréquence                     | Contrôle                                                           |
| ----------------------------- | ------------------------------------------------------------------ |
| Quotidien, 7 premiers jours   | Journaux Vercel : aucune erreur 500                                |
| Quotidien, 7 premiers jours   | Chaque demande de devis arrive-t-elle par courriel ?               |
| Hebdomadaire                  | Search Console : couverture, requêtes, pages en baisse             |
| Hebdomadaire                  | Vercel Speed Insights : Core Web Vitals réels                      |
| Mensuel                       | `npm run go-live` — même sans changement, pour détecter une dérive |
| Mensuel                       | Vérifier qu'une sauvegarde Supabase est bien restaurable           |
| Trimestriel                   | Relire les huit pages locales                                      |
| À chaque changement de grille | Le calculateur affiche-t-il la nouvelle grille après 1 h ?         |

**Le seul indicateur qui compte les trente premiers jours :** combien de
demandes de devis, et combien se transforment en chantiers. Tout le reste — le
score Lighthouse, la position dans les résultats, le nombre de pages indexées —
n'est qu'un moyen d'y arriver.
