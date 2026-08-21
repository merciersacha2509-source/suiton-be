# Mise en production privée — SUITON OS 1.0

Objectif : encaisser un premier vrai client. Pas plus, pas moins.

Durée réaliste : **une demi-journée**, dont une heure d'attente de propagation DNS.

---

## 0. Ce que ce document ne fait pas

Il ne rend pas le produit complet. À la fin, la chaîne réservation → chantier →
devis → validation → planning → portail fonctionne. Le terrain (Sprint 3), la
facturation Peppol (Sprint 4) et les automatisations Make (Sprint 5) n'existent
pas encore. **Vous facturerez vos premiers chantiers hors du logiciel.**

C'est assumé : mieux vaut une chaîne courte qui marche qu'une chaîne longue qui
ne tourne nulle part.

---

## 1. Supabase cloud

### Créer le projet

1. Région **Frankfurt (eu-central-1)** — la plus proche, et les données restent
   dans l'UE. Ce n'est pas un détail RGPD.
2. Plan **Pro (25 $/mois)**. Le plan gratuit met le projet en pause après
   7 jours d'inactivité et ne conserve aucune sauvegarde exploitable. Pour de
   vrais clients, ce n'est pas discutable.
3. Noter le mot de passe de la base — il n'est plus affiché ensuite.

### Appliquer le schéma

```bash
npx supabase login
npx supabase link --project-ref <ref-du-projet>
npx supabase db push          # applique les 13 migrations
```

Vérifier immédiatement :

```bash
SUPABASE_DB_URL="postgres://postgres.<ref>:<mdp>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" \
  npm run test:db
```

**34 vérifications doivent passer.** Si une seule échoue, ne poursuivez pas :
une contrainte manquante en production ne se rattrape pas après coup.

### Créer votre compte

Dashboard → Authentication → Users → **Add user** (e-mail + mot de passe fort,
« Auto Confirm User » coché). Puis dans SQL Editor :

```sql
update public.profiles
set role = 'admin', nom = 'Sacha Mercier'
where id = (select id from auth.users where email = 'votre@email');
```

L'inscription publique est désactivée dans `supabase/config.toml` — vérifiez que
c'est aussi le cas dans Authentication → Providers → Email.

### Sauvegardes

- Plan Pro : sauvegardes quotidiennes automatiques, 7 jours de rétention.
- Activer **Point-in-time recovery** (+ 100 $/mois) uniquement quand vous aurez
  une vingtaine de chantiers. Avant, la sauvegarde quotidienne suffit.
- **Testez une restauration avant le premier client réel.** Une sauvegarde
  jamais restaurée n'est pas une sauvegarde. Créez un projet jetable, restaurez
  dedans, lancez `npm run test:db`, supprimez-le.

---

## 2. Vercel

```bash
npx vercel link
npx vercel --prod
```

### Variables d'environnement

À saisir dans Project → Settings → Environment Variables, **scope Production**.

| Variable                                          | Où la trouver                     | Obligatoire |
| ------------------------------------------------- | --------------------------------- | ----------- |
| `NEXT_PUBLIC_SUPABASE_URL`                        | Supabase → Settings → API         | oui         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                   | idem                              | oui         |
| `NEXT_PUBLIC_SITE_URL`                            | `https://app.suiton.be`           | oui         |
| `SUPABASE_SERVICE_ROLE_KEY`                       | idem — **jamais côté navigateur** | oui         |
| `PORTAL_TOKEN_PEPPER`                             | `openssl rand -base64 32`         | oui         |
| `RESEND_API_KEY`                                  | Resend → API Keys                 | oui         |
| `RESEND_FROM`                                     | `SUITON <devis@suiton.be>`        | oui         |
| `NOTIFY_EMAIL`                                    | votre adresse                     | oui         |
| `GOOGLE_CLIENT_ID` / `_SECRET` / `_REFRESH_TOKEN` | § 4                               | non         |
| `GOOGLE_CALENDAR_ID`                              | `primary`                         | non         |
| `SENTRY_DSN`                                      | § 5                               | recommandé  |

`lib/env.ts` valide tout au démarrage : une variable obligatoire manquante fait
**échouer le déploiement**, pas la première réservation d'un client un vendredi
soir. C'est voulu.

### Le piège du `PORTAL_TOKEN_PEPPER`

Il entre dans le hachage des jetons de portail. **Le changer invalide tous les
liens déjà envoyés.** Générez-le une fois, sauvegardez-le dans votre
gestionnaire de mots de passe, et n'y touchez plus.

### Région

Project → Settings → Functions → Region : **Frankfurt (fra1)**. Par défaut
Vercel déploie aux États-Unis, ce qui ajoute 150 ms d'aller-retour vers Supabase
sur chaque requête et fait transiter les données hors UE.

---

## 3. Domaines

| Domaine         | Usage                                        |
| --------------- | -------------------------------------------- |
| `suiton.be`     | site public (projet distinct, déjà en place) |
| `app.suiton.be` | SUITON OS — cette application                |

Chez votre registraire :

```
app.suiton.be.   CNAME   cname.vercel-dns.com.
```

Puis, dans Supabase → Authentication → URL Configuration :

- Site URL : `https://app.suiton.be`
- Redirect URLs : `https://app.suiton.be/auth/callback`

**Sans cette étape, la connexion boucle sur elle-même.**

### Resend — DNS

Ajoutez les enregistrements SPF, DKIM et DMARC que Resend affiche pour
`suiton.be`. Sans domaine vérifié, vos devis partent en indésirables, et vous
mettrez trois semaines à comprendre pourquoi vos clients « ne répondent jamais ».

Vérifiez avec [mail-tester.com](https://www.mail-tester.com) : visez 9/10 minimum
avant le premier envoi réel.

---

## 4. Google Calendar (facultatif au lancement)

**Le système fonctionne sans.** `lib/calendar.ts` détecte l'absence de
configuration et reste en mode dégradé : les interventions vivent dans Supabase,
qui reste la source de vérité. Vous pouvez brancher Google plus tard sans rien
changer au code.

Quand vous voudrez le faire :

1. Google Cloud Console → nouveau projet → activer l'API Google Calendar.
2. Écran de consentement OAuth → **Externe** → ajouter votre adresse en
   utilisateur de test.
3. Identifiants → ID client OAuth → **Application de bureau**.
4. Obtenir un `refresh_token` avec le scope
   `https://www.googleapis.com/auth/calendar.events`, via l'OAuth Playground
   (« Use your own OAuth credentials »).
5. Renseigner les trois variables sur Vercel et redéployer.

Le `refresh_token` d'un projet en mode « test » expire au bout de 7 jours. Pour
un usage durable, publiez l'application (statut « En production ») — la
validation Google n'est pas requise tant que vous êtes le seul utilisateur.

---

## 5. Supervision

### Le minimum vital

1. **Sentry** — plan gratuit. Renseignez `SENTRY_DSN`. Sans lui, vous
   apprendrez vos pannes par un client mécontent.
2. **Vercel Analytics** — inclus. Surveillez le p75 du LCP sur `/reservation` :
   c'est la page qui fait entrer l'argent.
3. **Supabase → Database → Logs** — à consulter après chaque déploiement de
   migration.

### Sonde externe

Configurez une surveillance gratuite (UptimeRobot, Better Stack) sur :

```
https://app.suiton.be/api/health
```

Cette route vérifie que **la base répond**, pas seulement que Node est vivant.
Un serveur qui renvoie 200 sans base ne sert à rien.

Alerte si `base` ≠ `ok` ou si `latence_ms` > 1000.

### Ce que vous devez regarder chaque matin, la première semaine

- Le tableau de bord : y a-t-il des demandes non traitées ?
- Sentry : une erreur nouvelle ?
- Vos indésirables : un accusé de réception y a-t-il atterri ?

---

## 6. Recette de bascule

À exécuter **sur la production**, avant d'y envoyer un vrai client.
Comptez trente minutes.

| #   | Action                                                          | Attendu                                                              |
| --- | --------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | Ouvrir `https://app.suiton.be/reservation` en navigation privée | Le formulaire s'affiche, l'estimation apparaît dès la surface saisie |
| 2   | Remplir les 6 étapes avec **votre propre adresse**              | Écran de confirmation avec référence `SUITON-2026-XXXX`              |
| 3   | Consulter votre boîte                                           | Accusé de réception reçu, lien de portail cliquable                  |
| 4   | Consulter la boîte `NOTIFY_EMAIL`                               | Notification interne avec bande de score et téléphone                |
| 5   | Ouvrir le lien de portail                                       | Le dossier s'affiche, sans demander de mot de passe                  |
| 6   | Se connecter à `/chantiers`                                     | La demande est là, à l'étape « nouveau »                             |
| 7   | Ouvrir la fiche → **Générer le devis**                          | PDF produit, numéro `SUITON-D-2026-XXXX`                             |
| 8   | **Ouvrir le PDF**                                               | Montants corrects, TVA correcte, coordonnées et Peppol présents      |
| 9   | **Envoyer au client**                                           | E-mail reçu avec le montant                                          |
| 10  | Depuis le portail → **Accepter ce devis**                       | Confirmation, chantier passé en « gagné »                            |
| 11  | Fiche chantier → **Planifier**                                  | Intervention créée, visible dans `/planning`                         |
| 12  | Replanifier au même créneau                                     | **Refusé** — chevauchement, trajet compris                           |
| 13  | Ouvrir un lien de portail modifié d'un caractère                | Page 404 générique, aucune information                               |
| 14  | Envoyer 11 réservations d'affilée                               | La 11ᵉ renvoie une erreur de limitation, pas une page cassée         |
| 15  | Déposer une photo prise au téléphone                            | Aucune donnée GPS dans le fichier stocké (vérifier avec `exiftool`)  |
| 16  | Parcourir la réservation **au clavier seul**                    | Chaque étape franchissable, focus toujours visible                   |

Puis, dans Supabase, **supprimez le chantier de test** :

```sql
-- L'ordre compte : les contraintes de clé étrangère sont en RESTRICT.
delete from public.invoices  where job_id = '<uuid>';
delete from public.quotes    where job_id = '<uuid>';
delete from public.jobs      where id     = '<uuid>';
delete from public.clients   where email  = 'votre@email';
```

La numérotation ne se recycle pas : votre premier vrai devis portera le
numéro 0002. C'est normal et sans conséquence — une numérotation à trous se
remarque, une numérotation qui se répète est une infraction.

---

## 7. Retour arrière

| Incident                             | Réaction                                                                                                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bug bloquant après déploiement       | Vercel → Deployments → déploiement précédent → **Promote to Production**. Effet en 30 secondes.                                                                |
| Migration destructrice               | Supabase → Database → Backups → restaurer. **Perte des données depuis la dernière sauvegarde.**                                                                |
| Fuite du `SERVICE_ROLE_KEY`          | Supabase → Settings → API → régénérer, puis mettre à jour Vercel et redéployer. Toutes les sessions restent valides — la clé de service n'est pas une session. |
| Lien de portail transféré par erreur | Fiche chantier → **Régénérer le lien**. L'ancien est révoqué immédiatement.                                                                                    |
| Resend en panne                      | Les réservations continuent d'être enregistrées. L'écran de confirmation affiche le lien de portail et le signale. Rappelez le client.                         |
| Google Calendar en panne             | Les interventions restent en base. Reportez-les à la main dans votre agenda.                                                                                   |

**Ce qui ne se rattrape jamais** : une facture B2B émise sans identifiant Peppol.
La contrainte `b2b_peppol` l'empêche au niveau de la base. Ne la retirez sous
aucun prétexte, même « temporairement pour débloquer ».

---

## 8. Coût mensuel

| Poste        | Coût                                  |
| ------------ | ------------------------------------- |
| Supabase Pro | 25 $                                  |
| Vercel Pro   | 20 $                                  |
| Resend       | gratuit jusqu'à 3 000 e-mails/mois    |
| Sentry       | gratuit jusqu'à 5 000 événements/mois |
| Domaine      | ~15 €/an                              |
| **Total**    | **≈ 45 $/mois**                       |

À 45 $/mois pour un système qui traite l'intégralité du cycle commercial, le
point mort est atteint au premier chantier de l'année.

---

## 9. Après le premier client

Dans cet ordre :

1. **Sprint 3 — Terrain.** Vous ferez le chantier ; sans l'interface, pas de
   rapport photo, et le rapport photo est votre promesse commerciale.
2. **Sprint 4 — Facturation Peppol.** Obligatoire pour tout client
   professionnel depuis le 1ᵉʳ janvier 2026. Tant qu'il n'est pas livré,
   facturez vos clients B2B via votre outil comptable existant.
3. **Sprint 5 — Automatisations Make.** À faire seulement après avoir exécuté
   les relances à la main une dizaine de fois. Automatiser un processus qu'on
   n'a jamais exécuté revient à figer ses erreurs.
