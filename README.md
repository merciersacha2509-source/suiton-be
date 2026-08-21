# SUITON OS 1.0

Système d'exploitation de SUITON — nettoyage de fin de chantier, Enghien.
Le site public `suiton.be` et l'espace de gestion vivent dans ce dépôt.

> **Rien ne part en production sans le message explicite `GO PRODUCTION
SUITON`.** Voir `CLAUDE.md` et `docs/PRODUCTION.md`.

## Démarrer en trois commandes

```bash
npm install
cp .env.example .env.local
npm run demo            # données de démonstration + serveur local
```

http://localhost:3000 — un bandeau rappelle l'environnement, aucun courriel ne
part, aucune donnée réelle n'est en jeu.

## Trois environnements

| `APP_ENV`     | Où             | Indexable | Courriels                  | Données       |
| ------------- | -------------- | --------- | -------------------------- | ------------- |
| `development` | localhost:3000 | non       | capturés sur `/dev/emails` | démonstration |
| `preview`     | `*.vercel.app` | non       | capturés                   | démonstration |
| `production`  | suiton.be      | **oui**   | **envoyés**                | réelles       |

`APP_ENV` n'est pas `NODE_ENV` : une preview Vercel tourne en
`NODE_ENV=production` tout en devant rester non indexable.

## Documentation

- `CLAUDE.md` — consignes de travail, règles à ne pas franchir
- `docs/DEVELOPPEMENT.md` — installation, base, seed, tests, courriels
- `docs/PREVIEW.md` — déployer une preview et la faire valider
- `docs/PRODUCTION.md` — séquence de mise en ligne, **après accord explicite**
- `docs/ROLLBACK.md` — retour arrière : déploiement, migration, DNS, secrets
- `docs/RAPPORT-PREPRODUCTION.md` — état actuel, ce qu'il reste à valider
- `docs/LANCEMENT.md` — ce qui a été construit pour le lancement, et pourquoi
- `docs/MISE-EN-LIGNE-SUITON-BE.md` — audit complet et métriques mesurées
- `docs/SITE-SUITON-BE.md` — architecture du site public

## Le logiciel est terminé. Place à l'exploitation.

**Plan de mise en exploitation sur 90 jours** — planning semaine par semaine,
KPI, huit procédures, audit hebdomadaire, seuils et critères de réussite.

➡️ **[`docs/EXPLOITATION-90-JOURS.md`](docs/EXPLOITATION-90-JOURS.md)**

Deux corrections au plan initial y sont argumentées : le mois 3 demande 12 h
par jour en solo, et **45 chantiers concentrés valent mieux que 60
dispersés** — le moteur a besoin de 5 chantiers par gabarit, et il en existe 105.

Les fiches quotidienne et hebdomadaire sont imprimables :
`SUITON_fiches_exploitation.pdf`. Aucune nouvelle fonctionnalité pendant
90 jours — la liste d'attente est dans `AMELIORATIONS.md`.

**Ce qui n'existe pas encore** : la transmission Peppol des factures B2B
(Sprint 4) et les automatisations Make (Sprint 5). Pour un client
professionnel, SUITON OS produit un **brouillon PDF** et refuse de l'émettre —
voir « Facturation », plus bas.

➡️ **Pour mettre en ligne : [`docs/MISE-EN-PRODUCTION.md`](docs/MISE-EN-PRODUCTION.md)**

---

## Installation

```bash
npm install
cp .env.example .env.local
```

Démarrer Supabase en local (nécessite Docker et la CLI Supabase) :

```bash
supabase start          # affiche l'anon key et la service_role key
supabase db reset       # applique les 9 migrations + le seed
```

Reporter les deux clés affichées dans `.env.local`, puis générer un poivre :

```bash
openssl rand -base64 32   # -> PORTAL_TOKEN_PEPPER
```

Créer le premier compte (l'inscription publique est désactivée) :

```sql
-- Studio Supabase > SQL Editor
-- Le trigger on_auth_user_created crée le profil automatiquement.
select auth.uid();  -- après avoir créé l'utilisateur via Authentication > Add user
update public.profiles set role = 'admin', nom = 'Sacha Mercier'
where id = '<uuid de l utilisateur>';
```

Puis :

```bash
npm run dev     # http://localhost:3000
```

---

## Commandes

| Commande           | Effet                                                       |
| ------------------ | ----------------------------------------------------------- |
| `npm run dev`      | Serveur de développement                                    |
| `npm run verify`   | types + lint + tests + build — à passer avant chaque commit |
| `npm run test`     | 51 tests unitaires (tarification, score, TVA, formats, Zod) |
| `npm run test:db`  | 29 assertions de contraintes contre la base réelle          |
| `npm run db:reset` | Recrée la base et rejoue les migrations                     |
| `npm run db:types` | Régénère `src/types/database.ts` depuis le schéma           |

`npm run test:db` exige `supabase start`. Il tourne dans une transaction
annulée : il ne laisse aucune trace en base.

---

## Architecture

```
src/
├── app/
│   ├── (auth)/connexion/       connexion, Server Actions
│   ├── (public)/reservation/   parcours 6 étapes — public
│   ├── (app)/                  espace authentifié
│   │   ├── tableau-de-bord/    ce qui demande une décision aujourd'hui
│   │   ├── chantiers/          liste filtrée + fiche avec actions
│   │   ├── planning/           interventions à venir
│   │   ├── clients/            fichier client
│   │   ├── donnees/            cockpit · references · estimation
│   │   ├── intelligence/       décisions de la semaine · expériences
│   │   ├── playbook/           plans d'exécution · mémoire d'entreprise
│   │   ├── terrain/            journée + checklist + photos + rapport
│   │   ├── facturation/        production, envoi, suivi des impayés
│   │   └── parametres/         grille tarifaire
│   ├── portail/[token]/        dossier client — sans mot de passe
│   ├── api/booking/            réception d'une réservation
│   ├── api/slots/              créneaux réellement libres
│   ├── api/photos/upload/      dépôt + purge EXIF
│   ├── api/health/             sonde (vérifie la base, pas juste Node)
│   └── globals.css             design system
├── components/
│   ├── brand/                  symbole SUITON (SVG vectorisé)
│   ├── layout/                 coquille, navigation, menu, en-tête
│   └── ui/                     Button, Field, Input, Card, Badge, Table…
├── lib/
│   ├── env.ts                  validation Zod au démarrage
│   ├── supabase/               client / server / admin / middleware
│   ├── auth/                   session, capacités, gardes
│   ├── services/               booking · quotes · reports · invoices · portal
│   │                            documents (registre) · pipeline (chaîne)
│   │                            analytics (données) · metrics (extraction)
│   ├── pdf/                     tokens · fonts · blocks/ · documents/
│   │                            compose (pur) · render (serveur)
│   ├── emails/                  gabarit + 6 modèles avec pièces jointes
│   ├── intelligence.ts          estimation assistée, niveaux de confiance
│   ├── alertes.ts               moteur d'alertes actionnables (pur)
│   ├── recommandations.ts       moteur de décisions, ROI en fourchette (pur)
│   ├── experiences.ts           analyse avant/après, refus de conclure (pur)
│   ├── playbook.ts              plans, décision finale, bilan de valeur (pur)
│   ├── pricing.ts              tarification — source unique
│   ├── scoring.ts              score déterministe
│   ├── vat.ts                  TVA, autoliquidation
│   ├── tokens.ts               jetons de portail — hachés, jamais en clair
│   ├── photos.ts               purge EXIF, redimensionnement
│   ├── rate-limit.ts           limitation de débit adossée à la base
│   ├── calendar.ts             Google Calendar — dégradé si non configuré
│   ├── notify.ts               Resend — un échec n'annule jamais le métier
│   ├── storage.ts              URL signées, buckets privés
│   ├── zones.ts                zone tarifaire par code postal
│   ├── validation/             schémas partagés client + serveur
│   └── api.ts errors.ts format.ts cn.ts
├── tests/                      215 tests
├── types/database.ts           remplacé par `npm run db:types`
supabase/migrations/            9 migrations
scripts/test-schema.mjs         assertions de contraintes
middleware.ts                   rafraîchissement de session + routes protégées
```

### Cinq règles non négociables

1. **Supabase est la seule source de vérité.** Aucun état métier ailleurs.
   Pipedrive sera un miroir sortant, jamais lu en retour.
2. **La grille tarifaire n'est écrite en dur nulle part.** Elle vit dans
   `settings`. Un prix codé dans un composant est un bug.
3. **Le montant n'est jamais accepté en entrée d'une API.** Il est recalculé
   côté serveur. `bookingSchema` ne contient aucun champ de prix, et un test
   le vérifie.
4. **Un jeton de portail n'est jamais stocké en clair.** Seule son empreinte
   SHA-256 poivrée l'est. Conséquence assumée : un lien perdu ne se retrouve
   pas, il se régénère.
5. **Une notification qui échoue n'annule jamais l'opération métier.** Un client
   dont la réservation est enregistrée mais qui n'a pas reçu l'accusé peut être
   rappelé ; un client dont la réservation a échoué parce que Resend était en
   panne est perdu.

### Le client `admin`

`lib/supabase/admin.ts` contourne la RLS. Trois usages légitimes : l'écriture
d'une réservation publique validée, les webhooks signés, les tâches planifiées.
Tout autre usage est une erreur de conception — si un utilisateur authentifié
ne peut pas lire une donnée avec son propre client, c'est la politique RLS
qu'il faut corriger. Une règle ESLint le signale.

---

## Base de données

35 tables, 67 politiques RLS, 22 migrations. Les contraintes qui comptent :

| Contrainte                       | Table            | Ce qu'elle empêche                                               |
| -------------------------------- | ---------------- | ---------------------------------------------------------------- |
| `b2b_peppol`                     | invoices         | Émettre une facture B2B sans identifiant Peppol                  |
| `pas_de_chevauchement`           | interventions    | Deux interventions simultanées, tampon de trajet compris         |
| `pas_de_publication_avec_exif`   | photos           | Publier une image dont les métadonnées GPS n'ont pas été purgées |
| `jobs_publie_a_un_resume`        | jobs             | Publier une réalisation sans résumé rédigé (≥ 80 caractères)     |
| `clients_consent_date`           | clients          | Un consentement photo sans date — donc non prouvable             |
| `reports_observations_non_vides` | reports          | Un rapport sans observations                                     |
| `quotes_ttc_coherent`            | quotes           | HTVA + TVA ≠ TTC                                                 |
| `*_autoliquidation_sans_tva`     | quotes, invoices | Une TVA non nulle sous régime d'autoliquidation                  |

**Pourquoi en base et pas dans le code.** Depuis le 1er janvier 2026, une
facture B2B belge doit être structurée et transmise par Peppol. Un PDF n'y
satisfait pas et empêche le client de déduire sa TVA — il s'en aperçoit à sa
déclaration, plusieurs semaines plus tard, et le litige porte sur un montant
qu'il vous réclame. Une erreur applicative ne doit pas pouvoir produire cette
facture.

**Numérotation.** `counters` + `next_number()` avec `SELECT … FOR UPDATE`.
Compter les lignes existantes produirait des doublons en concurrence et un
trou après un rollback. Les deux se voient en contrôle fiscal.

**Bande de score.** Colonne générée par la base. Les mêmes seuils existent
dans `lib/scoring.ts` ; deux tests vérifient qu'ils correspondent, l'un en
TypeScript, l'autre en SQL. Toute modification doit toucher les deux.

---

## Rôles

| Rôle         | Voit                                                  | Ne voit pas                    |
| ------------ | ----------------------------------------------------- | ------------------------------ |
| `admin`      | Tout, plus les réglages et le journal d'audit         | —                              |
| `staff`      | Chantiers, clients, devis, factures, planning         | Réglages en écriture, audit    |
| `technicien` | Interventions de son équipe, photos, rapports         | **Montants et fichier client** |
| `partenaire` | Chantiers de son entreprise ; factures si responsable | Les autres clients             |

Le client n'a pas de compte : il accède à son dossier par lien opaque
(Sprint 4).

---

## Design system

Quatre couleurs d'identité, issues du brand book. **L'aqua est réservé à la
preuve** — photos, rapports, garanties. Les couleurs d'état ne servent qu'aux
états système. **Aucun dégradé décoratif.**

| Jeton       | Valeur    | Usage                          |
| ----------- | --------- | ------------------------------ |
| `abysse`    | `#0B2239` | Fonds sombres, texte principal |
| `ocean`     | `#14415F` | Surfaces secondaires, liens    |
| `aqua`      | `#5FC2CE` | Preuve — sur fond sombre       |
| `aqua-deep` | `#1E6E78` | Preuve — sur fond clair        |
| `mineral`   | `#F4F6F5` | Fond clair                     |

Polices auto-hébergées (Jura, Inter) : aucune requête tierce dans le chemin
de rendu. Cible tactile de 44 px (`h-touch`) — l'application se consulte sur
un chantier, parfois avec des gants.

---

## Critères d'acceptation du Sprint 1

| #   | Critère                                                            | Vérification                                          |
| --- | ------------------------------------------------------------------ | ----------------------------------------------------- |
| 1   | Le projet compile et démarre                                       | `npm run verify` — 0 erreur                           |
| 2   | Les 9 migrations s'appliquent sur une base vierge                  | `supabase db reset`                                   |
| 3   | RLS active sur toutes les tables publiques                         | `npm run test:db`                                     |
| 4   | Une variable d'environnement manquante fait échouer le démarrage   | retirer une ligne de `.env.local`, `npm run dev`      |
| 5   | Une route protégée redirige vers la connexion                      | `/tableau-de-bord` en navigation privée               |
| 6   | Un mauvais mot de passe ne révèle pas si le compte existe          | messages identiques dans les deux cas                 |
| 7   | L'administrateur modifie la grille et la variation est journalisée | `/parametres`, puis `select * from settings_history`  |
| 8   | Un rôle `staff` voit les paramètres en lecture seule               | changer le rôle, recharger `/parametres`              |
| 9   | Le montant n'est acceptable par aucune entrée d'API                | `npm run test` — test dédié dans `validation.test.ts` |
| 10  | Deux interventions ne peuvent pas se chevaucher                    | `npm run test:db`                                     |
| 11  | Une facture B2B ne peut pas être émise sans Peppol                 | `npm run test:db`                                     |
| 12  | Le parcours de connexion est franchissable au clavier seul         | Tab uniquement, focus visible à chaque étape          |

### État de vérification

Passés dans cet environnement : **1, 9, 10, 11** et l'ensemble des assertions
de schéma (via une instance PostgreSQL 18 réelle, avec `auth.users` et
`auth.uid()` simulés). `npm run verify` : 0 erreur de type, 0 erreur de lint,
51 tests, build réussi.

Restent à vérifier sur votre machine, parce qu'ils exigent Docker et un
navigateur : **2, 3, 4, 5, 6, 7, 8, 12**.

---

## Décisions structurantes du Sprint 2

**`create_booking()` en SQL.** Une réservation écrit dans cinq tables. Le client
JavaScript de Supabase n'a pas de transaction : cinq appels séparés
laisseraient, en cas d'échec du troisième, un client sans chantier et un
chantier sans portail. C'est le seul endroit du système où de la logique métier
vit en SQL, et c'est l'atomicité qui le justifie.

**Photos transitant par le serveur.** Pas d'URL signée remise au navigateur :
elle laisserait déposer le JPEG brut, coordonnées GPS du domicile comprises. Le
fichier est re-encodé en WebP par sharp, ce qui supprime les métadonnées par
construction.

**Limitation de débit en base.** Un compteur en mémoire ne limite rien sur
Vercel : chaque requête peut atterrir sur une instance différente.

**Google Calendar facultatif.** `estConfigure()` renvoie false tant que les
identifiants manquent, et le système reste pleinement fonctionnel. Le calendrier
est un miroir ; sa panne ne doit jamais bloquer une réservation.

**Un seul geste manuel dans toute la chaîne : l'envoi du devis.** Il part sous
la signature de SUITON, il mérite une relecture.

---

## Sprint 3 — Terrain

L'interface d'intervention : checklist en 6 étapes, photos avant/après
appariées, observations obligatoires, validation, rapport PDF. C'est ce qui
rend tenable la promesse commerciale — « nous prouvons le résultat ».

Le schéma est déjà en place (`reports`, `photos`, contrainte
`reports_checklist_complete`). Reste l'interface, pensée pour un téléphone,
sur un chantier, parfois avec des gants.

---

## Documents

Les trois PDF reproduisent les gabarits SUITON existants. Charte partagée dans
`src/lib/pdf/theme.tsx` : une modification s'y fait une seule fois.

| Document    | Particularité                                                                                                                                                                          |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Devis**   | Décomposé en **forfaits**, jamais en prix au m². Un prix au m² affiché invite à négocier le taux ; un forfait se discute en bloc ou pas du tout. Double signature « Bon pour accord ». |
| **Facture** | Encadré légal d'autoliquidation, coordonnées bancaires, **communication structurée** belge (modulo 97), conditions de paiement citant la loi du 2 août 2002 et l'indemnité de 40 EUR.  |
| **Rapport** | Procédure horodatée étape par étape, observations, garantie 48 h, page avant/après.                                                                                                    |

Trois pièges rencontrés et corrigés, chacun couvert par un test :

- L'espace fine insécable de `fr-BE` (U+202F) n'existe pas dans Helvetica :
  « 3 744,00 € » se rendait « 3/744,00 € ».
- Le caractère `✓` n'est pas dans l'encodage WinAnsi : la checklist paraissait
  vide. Il est désormais dessiné en SVG.
- `<View>` n'est pas accepté dans un `<Svg>` @react-pdf — il faut `<G>`.

---

## Facturation — la limite du Sprint 3

Depuis le 1ᵉʳ janvier 2026, une facture B2B belge doit être transmise au format
**structuré via Peppol**. Un PDF n'y satisfait pas et empêche le client de
déduire sa TVA — il s'en aperçoit à sa déclaration, plusieurs semaines plus
tard, et le litige porte sur un montant qu'il vous réclame.

SUITON OS ne transmet pas encore par Peppol. Conséquence assumée :

| Client            | Comportement                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Particulier**   | Facture émise, PDF envoyé, suivi de paiement — tout se fait ici.                                                               |
| **Professionnel** | **Brouillon PDF uniquement.** Le service lève `PeppolRequisError` et refuse d'émettre. Reprenez-le dans votre outil comptable. |

Ce n'est pas une omission mais un garde-fou : la contrainte `b2b_peppol`
refuserait de toute façon l'émission au niveau de la base.

---

## Terrain

`/terrain` liste trois jours. `/terrain/[id]` est l'écran de chantier :

- **Un seul bouton visible à la fois** — « Je pars », puis « Je suis arrivé ».
  Sur un chantier, quatre actions simultanées font hésiter.
- **Checklist en six étapes**, chacune un formulaire indépendant : cocher la
  troisième ne recharge pas les cinq autres, et un réseau capricieux ne fait
  perdre qu'une action.
- **L'horodatage vient du serveur**, jamais du téléphone. Six étapes validées à
  la même minute signalent une checklist cochée après coup — et c'est
  précisément cet horodatage qui rend la procédure opposable.
- **Photos appariées** : une paire = une pièce, avant puis après, même numéro.
  La contrainte SQL empêche deux « avant » dans la même paire.
- **Aucun montant.** Le téléphone d'un technicien peut être perdu ou volé : la
  vue `vue_terrain` n'expose ni prix ni fichier client.

À la validation, le rapport PDF est produit et envoyé, l'intervention est
close, la durée réelle calculée et le chantier passe en « terminé ».

---

## Sprint 4

1. **Billit + Peppol.** Débloque la facturation professionnelle, qui est
   aujourd'hui la seule rupture de la chaîne.
2. **Séquence d'avis Google.** J+1 remerciement, J+2 demande, J+5 relance —
   sollicitation identique pour tous, sans filtrage : Google sanctionne le
   _review gating_ par retrait rétroactif.
3. **Automatisations Make.** À faire seulement après avoir exécuté les relances
   à la main une dizaine de fois : automatiser un processus jamais exécuté
   revient à figer ses erreurs.

### Vérification

- `docs/preuves/` — sortie brute des contrôles
- `npm run go-live` — 536 contrôles : typecheck, lint, 249 tests, build, audit
  du site, migrations sur PostgreSQL réel, schéma et RLS, coefficients, seed,
  bout en bout HTTP, sécurité

Un test vert ne remplace pas la validation visuelle : le rendu sur téléphone
n'est vérifié par aucun automatisme.
