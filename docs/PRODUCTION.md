# Production

> **Aucune étape de ce document ne s'exécute avant le message explicite
> `GO PRODUCTION SUITON` de Sacha Mercier.**
>
> Les procédures ci-dessous sont écrites pour être prêtes, pas pour être
> lancées. Les commandes `npm run prod:*` n'exécutent rien : elles affichent
> l'action, son impact et le retour arrière, puis exigent une confirmation
> tapée à la main.

L'audit complet, les métriques mesurées et la procédure d'indexation Google
sont dans `MISE-EN-LIGNE-SUITON-BE.md`. Ce document-ci est la séquence
opératoire.

---

## 1. Ce qui bloque la production

Tant qu'un seul de ces points est rouge, il n'y a pas de mise en ligne.

### Automatisé

```bash
npm run go-live      # 536 contrôles
```

### Humain — irremplaçable

- [ ] Sacha a parcouru la **preview sur un vrai téléphone** (`docs/PREVIEW.md` § 4)
- [ ] Sacha a relu les **huit pages locales** : décrivent-elles sa réalité ?
- [ ] Sacha a relu les **prix affichés** : sont-ce ceux qu'il facturerait ?
- [ ] Sacha a relu les **sept courriels** sur `/dev/emails`
- [ ] Sacha a écrit **`GO PRODUCTION SUITON`**

### Infrastructure

- [ ] Projet Supabase de production créé, **région UE (Francfort)**
- [ ] Sauvegardes automatiques Supabase actives et **vérifiées restaurables**
- [ ] Buckets `chantiers` et `documents` créés, **privés**
- [ ] Domaine `suiton.be` vérifié chez **Resend**, SPF + DKIM + DMARC publiés
- [ ] Courriel de test reçu **en boîte de réception**, pas en indésirables
- [ ] `PORTAL_TOKEN_PEPPER` de production généré aléatoirement, **différent**
      de celui de développement et de preview

---

## 2. Variables de production

**Vercel → Settings → Environment Variables → Production.**

```
APP_ENV=production
NEXT_PUBLIC_APP_ENV=production
EMAIL_MODE=production
NEXT_PUBLIC_SITE_URL=https://suiton.be
NEXT_PUBLIC_SUPABASE_URL=https://<projet>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clé anon>
SUPABASE_SERVICE_ROLE_KEY=<clé service_role>
PORTAL_TOKEN_PEPPER=<openssl rand -base64 32>
RESEND_API_KEY=<clé>
RESEND_FROM=SUITON <no-reply@suiton.be>
NOTIFY_EMAIL=suiton.detailing@gmail.com
CRON_SECRET=<openssl rand -base64 32>
```

Trois valeurs sur lesquelles une erreur coûte cher :

**`NEXT_PUBLIC_SITE_URL` doit valoir exactement `https://suiton.be`**, sans
barre finale. Toutes les URL canoniques et le sitemap en dérivent. Une barre
en trop produit des canoniques en `https://suiton.be//devis`.

**`EMAIL_MODE=production`** est ce qui fait basculer d'une capture sur disque
à un envoi réel. Tant qu'il vaut `preview`, aucun client ne reçoit rien.

**`APP_ENV=production`** est ce qui rend le site indexable. Tant qu'il ne vaut
pas `production`, `robots.txt` renvoie `Disallow: /`.

---

## 3. Séquence

Chaque étape se vérifie avant la suivante.

| #   | Étape                            | Commande                                                              | Vérification         |
| --- | -------------------------------- | --------------------------------------------------------------------- | -------------------- |
| 1   | Chaîne complète en local         | `npm run go-live`                                                     | 536 / 536            |
| 2   | Sauvegarde de la base            | `supabase db dump -f sauvegarde-$(date +%Y%m%d-%H%M).sql --data-only` | fichier non vide     |
| 3   | Migrations à blanc               | `supabase db push --dry-run`                                          | lire ligne par ligne |
| 4   | Migrations                       | `npm run prod:migrate`                                                | 24 migrations        |
| 5   | Variables                        | `npm run prod:env`                                                    | `vercel env ls`      |
| 6   | Déploiement                      | `npm run prod:deploy`                                                 | déploiement vert     |
| 7   | Domaine et DNS                   | `npm run prod:dns`                                                    | certificat émis      |
| 8   | Contrôles § 4                    | —                                                                     | tous verts           |
| 9   | Réservation réelle § 5           | —                                                                     | 201 + courriel reçu  |
| 10  | Search Console, Business Profile | `MISE-EN-LIGNE-SUITON-BE.md` § 9                                      | —                    |

**Fenêtre : mardi ou mercredi matin.** Jamais un vendredi : si quelque chose
casse, on veut deux jours ouvrés devant soi, pas un week-end.

**Valider sur l'URL `*.vercel.app` AVANT de pointer le domaine.** Un DNS raté
n'est pas rattrapable rapidement (`ROLLBACK.md` § 3).

---

## 4. Contrôles après mise en ligne

```bash
# Codes de réponse
for u in / /nettoyage-fin-de-chantier /nettoyage-fin-de-chantier/enghien \
         /nettoyage-de-vitres /devis /professionnels /realisations /contact \
         /a-propos /reservation /sitemap.xml /robots.txt; do
  printf '%-45s %s\n' "$u" "$(curl -s -o /dev/null -w '%{http_code}' https://suiton.be$u)"
done

# L'environnement est bien la production
curl -s https://suiton.be/robots.txt | head -3        # Allow: / — PAS Disallow: /
curl -sI https://suiton.be | grep -i x-robots         # doit être ABSENT
curl -s https://suiton.be/ | grep -o '<meta name="robots"[^>]*>'   # index, follow

# Les outils de développement sont introuvables
curl -s -o /dev/null -w '%{http_code}\n' https://suiton.be/dev/emails   # 404

# www redirige vers l'apex, HTTP vers HTTPS
curl -sI https://www.suiton.be | grep -i '^location'
curl -sI http://suiton.be | grep -iE '^(HTTP|location)'

# En-têtes de sécurité
curl -sI https://suiton.be | grep -iE 'strict-transport|content-security|x-frame|referrer'

# TTFB réel
for i in $(seq 1 10); do curl -s -o /dev/null -w '%{time_starttransfer}\n' https://suiton.be/; done

# Une URL inventée renvoie 404, pas 200
curl -s -o /dev/null -w '%{http_code}\n' https://suiton.be/nettoyage-de-piscine

# L'espace de gestion redirige
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://suiton.be/tableau-de-bord
```

Le contrôle `x-robots-tag` **absent** est celui qui prouve que `APP_ENV` vaut
bien `production`. S'il est présent, le site est en ligne mais invisible pour
Google.

---

## 5. Réservation réelle

**Une seule fois**, avec votre propre adresse, puis supprimer le chantier.

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
estimation de 980–1120 € — **et un courriel dans votre boîte**.

C'est le seul contrôle qui valide réellement l'envoi de courriels. Vérifier
qu'il n'est **pas** en indésirables. Ouvrir ensuite le lien de portail.

Puis supprimer le chantier de test depuis l'espace de gestion.

---

## 6. Les sept premiers jours

| Fréquence | Contrôle                                                  |
| --------- | --------------------------------------------------------- |
| Quotidien | Journaux Vercel : aucune erreur 500                       |
| Quotidien | Chaque demande de devis arrive-t-elle par courriel ?      |
| J+2       | Search Console : sitemap accepté                          |
| J+7       | Couverture : 20 pages valides                             |
| J+7       | Vercel Speed Insights : LCP, CLS, INP réels des visiteurs |

**Le seul indicateur qui compte les trente premiers jours :** combien de
demandes de devis, et combien deviennent des chantiers.
