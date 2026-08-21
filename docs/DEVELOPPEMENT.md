# Développement

De zéro à un SUITON qui tourne sur votre machine, avec des données de
démonstration et sans risque pour la production.

---

## 1. Installation

```bash
git clone <dépôt> suiton
cd suiton
npm install
```

Node 22 ou plus. `npm install` installe aussi `embedded-postgres`, qui permet
de faire tourner un PostgreSQL réel sans Docker — c'est ce dont se servent les
contrôles de schéma.

---

## 2. Variables d'environnement

```bash
cp .env.example .env.local
```

Les valeurs par défaut suffisent pour développer. Trois seulement comptent :

```bash
APP_ENV=development          # noindex, bandeau visible
EMAIL_MODE=preview           # aucun courriel ne part
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`.env.local` est ignoré par Git. **Aucune clé réelle n'entre dans
`.env.example`** — il est versionné.

> **Piège Next.js.** Les variables `NEXT_PUBLIC_*` sont figées **à la
> compilation** : elles sont remplacées par des littéraux dans le bundle. Les
> modifier n'a aucun effet tant qu'on n'a pas reconstruit. C'est la première
> cause de « j'ai changé la variable et rien ne bouge ».

---

## 3. Base de données

### Option A — Supabase local (recommandé)

```bash
supabase start        # nécessite Docker
npm run db:reset      # applique les 24 migrations
```

`supabase start` affiche l'URL et les clés à recopier dans `.env.local`.

### Option B — sans Docker

Les scripts de vérification montent un PostgreSQL 18 embarqué et appliquent
les migrations sans rien installer :

```bash
npm run prod:db       # monte la base, applique les 24 migrations, inventorie
npm run prod:schema   # 117 assertions sur le schéma et la RLS
```

Utile pour vérifier une migration. Insuffisant pour faire tourner
l'application, qui a besoin de PostgREST — c'est-à-dire de Supabase.

---

## 4. Données de démonstration

```bash
npm run db:seed
```

Crée un parcours complet :

| Étape             | Contenu                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| Demande fraîche   | Maison 140 m² à Enghien, arrivée ce matin                                                            |
| Devis envoyé      | Appartement 95 m² à Nivelles, urgent, en attente                                                     |
| Chantier planifié | Villa 260 m² à Waterloo, intervention la semaine prochaine                                           |
| Chantier livré    | Appartement 88 m² à Hal — devis accepté, checklist, rapport, facture Peppol, **réalisation publiée** |
| Chantier perdu    | Studio à Tubize — le pipeline doit aussi montrer ce qui échoue                                       |

**Trois marqueurs rendent la confusion impossible :**

- tout nom commence par `DÉMO — `
- toute adresse est en `@demo.suiton.invalid` — le TLD `.invalid` est réservé
  par la RFC 2606, il ne se résout jamais. Même un envoi accidentel
  n'atteindrait personne.
- tout numéro est en `0400 00 00 xx`, plage non attribuée en Belgique

Un seul marqueur suffirait ; les trois ensemble rendent l'erreur invisible
impossible, y compris à l'œil nu dans une liste.

```bash
npm run db:reset-demo   # supprime puis recrée
```

Le seed **refuse de s'exécuter** si `APP_ENV=production`, ou si la base visée
n'est ni locale ni explicitement autorisée par `SUITON_SEED_AUTORISE=1`.

---

## 5. Lancer

```bash
npm run dev      # http://localhost:3000
npm run demo     # seed puis dev — pour une démonstration
```

Un bandeau en haut de page rappelle l'environnement. Il disparaît en
production.

---

## 6. Parcours à tester

### Côté client

`/` → un service → calculateur (type de bien, surface, salissure, commune) →
estimation → `/reservation` → coordonnées → créneau → confirmation → portail.

Le lien de portail apparaît dans la réponse de l'API **et** dans le courriel
capturé sur `/dev/emails`.

### Côté dirigeant

`/connexion` → tableau de bord → chantiers → devis → planning → terrain →
facturation → données → intelligence → playbook → réglages.

Créer un compte depuis Supabase Studio (`Authentication → Add user`) ; le
déclencheur `on_auth_user_created` crée le profil.

### Côté client livré

Portail avec le jeton du chantier livré : rapport, documents, photos, et
« demander un nouveau devis ».

---

## 7. Courriels

`EMAIL_MODE=preview` : **rien ne part**. Chaque message est écrit dans
`.emails/` et consultable sur **`/dev/emails`** — HTML rendu tel que le verra
le client, version texte, pièces jointes.

Le test vaut la peine d'être connu : même avec une vraie `RESEND_API_KEY` dans
`.env.local`, rien n'est envoyé. Le contrôle du mode vient **avant** la lecture
de la clé, délibérément.

`/dev` renvoie un 404 en production, avant même de rendre la page.

---

## 8. Tests

```bash
npm run typecheck    # TypeScript strict
npm run lint
npm run test         # 249 tests unitaires
npm run audit        # 23 pages : SEO, accessibilité, budgets, maillage
```

Base réelle, sans Docker :

```bash
npm run prod:db        # 24 migrations
npm run prod:schema    # 117 assertions schéma et RLS
npm run prod:coef      # bornes des coefficients
npm run prod:seed      # marquage et idempotence du seed
npm run prod:e2e       # 78 contrôles HTTP de bout en bout
npm run prod:securite  # 66 contrôles de sécurité
npm run prod:perf      # TTFB, poids, charge
```

Tout d'un coup :

```bash
npm run go-live       # 536 contrôles
```

> Les contrôles de bout en bout reconstruisent l'application avec l'URL d'une
> passerelle locale — les variables `NEXT_PUBLIC_*` étant figées à la
> compilation. Poser `SUITON_SKIP_BUILD=1` pour enchaîner plusieurs scripts
> sans reconstruire.

---

## 9. Build

```bash
npm run build
npm run start
```

---

## 10. Ensuite

- `docs/PREVIEW.md` — déployer une preview à faire valider
- `docs/PRODUCTION.md` — mise en ligne, **après accord explicite**
- `docs/ROLLBACK.md` — quand ça casse
